import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Types } from 'mongoose';

import type { TimestampedDocument } from '@/shared/types/mongo';

import { QR_STATUSES, type QrStatus } from '../interfaces/qr.types';

// Тип контейнера для UI-иконки и правил вложения.
// "Корневой" статус определяется через parentId === null, отдельного kind для этого не надо.
export const CONTAINER_KIND = [
  'room', // помещение: квартира, комната, кухня, гараж, балкон, кладовка
  'cabinet', // закрытая мебель: шкаф, тумба, комод, гардероб, стеллаж
  'drawer', // секция мебели: ящик, полка, отделение, этажерка
  'box', // жёсткая переносная тара: коробка, контейнер, корзина
  'bag', // мягкая тара: сумка, пакет, рюкзак, чехол
] as const;

export type ContainerKind = (typeof CONTAINER_KIND)[number];

export type ContainerDocument = TimestampedDocument<Container>;

@Schema({ timestamps: true })
export class Container {
  // владелец контейнера
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  ownerId: Types.ObjectId;

  // имя контейнера
  @Prop({ required: true, trim: true, minlength: 1, maxlength: 128 })
  name: string;

  // тип контейнера для UI-иконки и логики правил
  @Prop({ type: String, enum: CONTAINER_KIND, default: null })
  kind: ContainerKind | null;

  // прямой родитель в дереве. null = root-уровень
  @Prop({
    type: Types.ObjectId,
    ref: 'Container',
    default: null,
    index: true, // индекс для оптимизации запросов на поиск дочерних контейнеров
  })
  parentId: Types.ObjectId | null;

  // root-контейнер дерева. Для root-контейнера rootId === null.
  @Prop({
    type: Types.ObjectId,
    ref: 'Container',
    default: null,
    index: true,
  })
  rootId: Types.ObjectId | null;

  // effective rule — правило иерархии (копируется от parent при создании)
  @Prop({
    type: Types.ObjectId,
    ref: 'ContainerRule',
    default: null,
  })
  ruleId: Types.ObjectId | null;

  @Prop({ type: String, enum: QR_STATUSES, default: 'none' })
  qrStatus: QrStatus;

  @Prop({ type: String, default: null })
  qrKey: string | null;
}

export const ContainerSchema = SchemaFactory.createForClass(Container);

// композитный индекс для оптимизации запросов на поиск контейнеров по владельцу и родителю
ContainerSchema.index({ ownerId: 1, parentId: 1 });
