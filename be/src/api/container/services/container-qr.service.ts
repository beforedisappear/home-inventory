import { InjectQueue } from '@nestjs/bullmq';
import { ConflictException, Injectable } from '@nestjs/common';

import { Queue } from 'bullmq';

import { StorageService } from '@/libs/storage/storage.service';

import {
  CONTAINER_QR_GENERATE_JOB,
  CONTAINER_QR_QUEUE,
  ContainerQrGenerateJobData,
} from '../constants/container-qr-queue';
import { ContainerRepository } from '../repositories/container.repository';

@Injectable()
export class ContainerQrService {
  constructor(
    private readonly repo: ContainerRepository,
    private readonly storage: StorageService,
    @InjectQueue(CONTAINER_QR_QUEUE)
    private readonly queue: Queue<ContainerQrGenerateJobData>,
  ) {}

  async enqueueGenerate(containerId: string, ownerId: string) {
    const updated = await this.repo.setQrPending(containerId);

    if (!updated)
      throw new ConflictException('QR generation already in progress');

    await this.queue.add(CONTAINER_QR_GENERATE_JOB, { containerId, ownerId });
  }

  async deleteIfExists(key: string | null) {
    if (!key) return;

    return this.storage.delete(key).catch(() => undefined);
  }
}
