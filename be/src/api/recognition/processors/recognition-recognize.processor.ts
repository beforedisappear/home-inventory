import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';

import { Job } from 'bullmq';
import { Types } from 'mongoose';

import { CategoryService } from '@/api/category/services/category.service';
import { AI_CLIENT } from '@/libs/ai/constants/di';
import type { AiClient } from '@/libs/ai/interfaces/ai-client.interface';

import { RECOGNITION_SYSTEM_PROMPT } from '../constants/recognition';
import {
  RECOGNITION_QUEUE,
  RECOGNITION_RECOGNIZE_JOB,
} from '../constants/recognition-queue';
import { type RecognitionRecognizeJobData } from '../interfaces/recognition-recognize.interface';
import { RecognitionRepository } from '../repositories/recognition.repository';
import { RecognitionDraft } from '../schemas/recognition-draft.schema';
import { RecognitionEventsService } from '../services/recognition-events.service';
import { RecognitionImageService } from '../services/recognition-image.service';
import { parseVisionResponse } from '../utils/parse-vision-response';
import { buildRecognitionPrompt } from '../utils/recognition-prompt';
import { sanitizeDraft } from '../utils/sanitize-draft';

interface CategoryRef {
  id: string;
  name: string;
}

@Processor(RECOGNITION_QUEUE)
export class RecognitionRecognizeProcessor extends WorkerHost {
  private readonly logger = new Logger(RecognitionRecognizeProcessor.name);

  constructor(
    private readonly repo: RecognitionRepository,
    private readonly images: RecognitionImageService,
    private readonly categoryService: CategoryService,
    private readonly eventsService: RecognitionEventsService,

    @Inject(AI_CLIENT)
    private readonly ai: AiClient,
  ) {
    super();
  }

  async process(job: Job<RecognitionRecognizeJobData>) {
    if (job.name !== RECOGNITION_RECOGNIZE_JOB) {
      this.logger.warn(`unknown job name: ${job.name}`);
      return;
    }

    const { recognitionId, ownerId } = job.data;

    const started = await this.repo.startProcessing(recognitionId);

    if (!started) {
      this.logger.log(`recognition ${recognitionId} not pending, skipping`);
      return;
    }

    if (!started.imageKey || !started.imageMime)
      throw new Error(`recognition ${recognitionId} has no image`);

    const image = await this.images.get(started.imageKey);

    const categories = await this.categoryService.findAll();

    const names = categories.map((c) => c.name);

    const raw = await this.ai.complete({
      system: RECOGNITION_SYSTEM_PROMPT,
      prompt: buildRecognitionPrompt(names),
      images: [{ data: image, mimeType: started.imageMime }],
      json: true,
    });

    // пока крутилась модель, юзер мог отменить — выкидываем результат
    const current = await this.repo.findByIdAndOwner(recognitionId, ownerId);

    if (!current || current.status === 'cancelled') {
      await this.images.discard(started.imageKey);
      this.logger.log(`recognition ${recognitionId} cancelled mid-flight`);
      return;
    }

    const clean = sanitizeDraft(parseVisionResponse(raw));

    const categoryId = this.matchCategoryId(clean.categoryName, categories);

    const draft: RecognitionDraft = {
      name: clean.name,
      description: clean.description,
      categoryId: categoryId ? new Types.ObjectId(categoryId) : null,
      categoryName: clean.categoryName,
      customFields: clean.customFields,
    };

    await this.repo.setReady(recognitionId, draft);

    // кадр больше не нужен — он был только ради распознавания
    await this.images.discard(started.imageKey);

    this.eventsService.emit({
      userId: ownerId,
      recognitionId,
      status: 'ready',
    });
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<RecognitionRecognizeJobData>, err: Error) {
    const id = job.data?.recognitionId;

    const attempts = job.opts.attempts ?? 1;
    const isLastAttempt = job.attemptsMade >= attempts;

    this.logger.error(
      `recognition ${id} attempt ${job.attemptsMade}/${attempts} failed: ${err.message}`,
      err.stack,
    );

    if (!id || !isLastAttempt) return;

    await this.repo.setFailed(id, err.message).catch(() => undefined);

    const doc = await this.repo
      .findByIdAndOwner(id, job.data.ownerId)
      .catch(() => null);

    if (doc?.imageKey) await this.images.discard(doc.imageKey);

    this.eventsService.emit({
      userId: job.data.ownerId,
      recognitionId: id,
      status: 'failed',
    });
  }

  // best-effort матч имени категории от модели к существующей (case-insensitive)
  private matchCategoryId(
    name: string | null,
    categories: CategoryRef[],
  ): string | null {
    if (!name) return null;

    const norm = name.trim().toLowerCase();
    const hit = categories.find((c) => c.name.trim().toLowerCase() === norm);

    return hit ? hit.id : null;
  }
}
