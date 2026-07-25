import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import { Job } from 'bullmq';

import { StorageService } from '@/libs/storage/storage.service';
import { generateQrSvg } from '@/shared/utils/generate-qr';

import {
  CONTAINER_QR_MIME,
  CONTAINER_QR_PAYLOAD_PREFIX,
  containerQrStorageKey,
} from '../constants/container-qr';
import {
  CONTAINER_QR_GENERATE_JOB,
  CONTAINER_QR_QUEUE,
  ContainerQrGenerateJobData,
} from '../constants/container-qr-queue';
import { ContainerRepository } from '../repositories/container.repository';

@Processor(CONTAINER_QR_QUEUE)
export class ContainerQrGenerateProcessor extends WorkerHost {
  private readonly logger = new Logger(ContainerQrGenerateProcessor.name);

  constructor(
    private readonly repo: ContainerRepository,
    private readonly storage: StorageService,
  ) {
    super();
  }

  async process(job: Job<ContainerQrGenerateJobData>) {
    if (job.name !== CONTAINER_QR_GENERATE_JOB) {
      this.logger.warn(`unknown job name: ${job.name}`);
      return;
    }

    const { containerId, ownerId } = job.data;

    const payload = `${CONTAINER_QR_PAYLOAD_PREFIX}${containerId}`;
    const svg = await generateQrSvg(payload);
    const key = containerQrStorageKey(ownerId, containerId);

    await this.storage.uploadBuffer(
      key,
      Buffer.from(svg, 'utf8'),
      CONTAINER_QR_MIME,
    );
    await this.repo.setQrReady(containerId, key);

    this.logger.log(`qr ready: containerId=${containerId} key=${key}`);
  }

  // переводим в failed только когда BullMQ исчерпал все ретраи
  @OnWorkerEvent('failed')
  async onFailed(job: Job<ContainerQrGenerateJobData>) {
    const exhausted = job.attemptsMade >= (job.opts.attempts ?? 1);

    if (!exhausted) return;

    try {
      await this.repo.setQrFailed(job.data.containerId);

      const message = `qr failed (exhausted): containerId=${job.data.containerId} reason=${job.failedReason}`;

      this.logger.warn(message);
    } catch (error) {
      const message = `qr failed-handler error: containerId=${job.data.containerId}`;

      this.logger.error(message, error);
    }
  }
}
