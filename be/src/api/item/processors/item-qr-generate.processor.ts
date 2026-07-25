import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import { Job } from 'bullmq';

import { StorageService } from '@/libs/storage/storage.service';
import { generateQrSvg } from '@/shared/utils/generate-qr';

import {
  ITEM_QR_MIME,
  ITEM_QR_PAYLOAD_PREFIX,
  itemQrStorageKey,
} from '../constants/item-qr';
import {
  ITEM_QR_GENERATE_JOB,
  ITEM_QR_QUEUE,
  ItemQrGenerateJobData,
} from '../constants/item-qr-queue';
import { ItemRepository } from '../repositories/item.repository';

@Processor(ITEM_QR_QUEUE)
export class ItemQrGenerateProcessor extends WorkerHost {
  private readonly logger = new Logger(ItemQrGenerateProcessor.name);

  constructor(
    private readonly repo: ItemRepository,
    private readonly storage: StorageService,
  ) {
    super();
  }

  async process(job: Job<ItemQrGenerateJobData>) {
    if (job.name !== ITEM_QR_GENERATE_JOB) {
      this.logger.warn(`unknown job name: ${job.name}`);
      return;
    }

    const { itemId, ownerId } = job.data;

    const payload = `${ITEM_QR_PAYLOAD_PREFIX}${itemId}`;
    const svg = await generateQrSvg(payload);
    const key = itemQrStorageKey(ownerId, itemId);

    await this.storage.uploadBuffer(
      key,
      Buffer.from(svg, 'utf8'),
      ITEM_QR_MIME,
    );
    await this.repo.setQrReady(itemId, key);

    this.logger.log(`qr ready: itemId=${itemId} key=${key}`);
  }

  // переводим в failed только когда BullMQ исчерпал все ретраи
  @OnWorkerEvent('failed')
  async onFailed(job: Job<ItemQrGenerateJobData>) {
    const exhausted = job.attemptsMade >= (job.opts.attempts ?? 1);

    if (!exhausted) return;

    try {
      await this.repo.setQrFailed(job.data.itemId);

      const message = `qr failed (exhausted): itemId=${job.data.itemId} reason=${job.failedReason}`;

      this.logger.warn(message);
    } catch (error) {
      const message = `qr failed-handler error: itemId=${job.data.itemId}`;

      this.logger.error(message, error);
    }
  }
}
