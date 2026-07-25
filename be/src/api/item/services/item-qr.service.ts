import { InjectQueue } from '@nestjs/bullmq';
import { ConflictException, Injectable } from '@nestjs/common';

import { Queue } from 'bullmq';

import { StorageService } from '@/libs/storage/storage.service';

import {
  ITEM_QR_GENERATE_JOB,
  ITEM_QR_QUEUE,
  ItemQrGenerateJobData,
} from '../constants/item-qr-queue';
import { ItemRepository } from '../repositories/item.repository';

@Injectable()
export class ItemQrService {
  constructor(
    private readonly repo: ItemRepository,
    private readonly storage: StorageService,
    @InjectQueue(ITEM_QR_QUEUE)
    private readonly queue: Queue<ItemQrGenerateJobData>,
  ) {}

  async enqueueGenerate(itemId: string, ownerId: string) {
    const updated = await this.repo.setQrPending(itemId);

    if (!updated)
      throw new ConflictException('QR generation already in progress');

    await this.queue.add(ITEM_QR_GENERATE_JOB, { itemId, ownerId });
  }

  async deleteIfExists(key: string | null) {
    if (!key) return;

    return this.storage.delete(key).catch(() => undefined);
  }
}
