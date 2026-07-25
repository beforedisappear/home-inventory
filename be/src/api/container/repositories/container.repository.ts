import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { Model, Types } from 'mongoose';

import { CreateContainerDto } from '../dto/create-container.dto';
import { UpdateContainerDto } from '../dto/update-container.dto';
import { Container, ContainerDocument } from '../schemas/container.schema';

@Injectable()
export class ContainerRepository {
  constructor(
    @InjectModel(Container.name)
    private readonly containerModel: Model<ContainerDocument>,
  ) {}

  findById(id: string) {
    return this.containerModel.findById(id).exec();
  }

  findByOwner(ownerId: string) {
    return this.containerModel.find({ ownerId }).exec();
  }

  findChildrenByOwner(ownerId: string, parentId: string | null) {
    return this.containerModel.find({ ownerId, parentId }).exec();
  }

  countChildren(parentId: string) {
    return this.containerModel.countDocuments({ parentId }).exec();
  }

  /**
   *  Все id поддерева включая сам root — через один $graphLookup.
   *  Для bulk-операций (cascade rule update, cascade delete).
   */
  async findSubtreeIds(rootId: string): Promise<string[]> {
    const [result] = await this.containerModel.aggregate<{
      ids: Types.ObjectId[];
    }>([
      // находим рутовый узел по id
      { $match: { _id: new Types.ObjectId(rootId) } },
      {
        // рекурсивно обходим дерево вниз
        $graphLookup: {
          from: this.containerModel.collection.name,
          startWith: '$_id', // начинаем с _id текущего документа
          connectFromField: '_id', // берём _id каждого найденного документа
          connectToField: 'parentId', // ищем документы где parentId === этому _id
          as: 'descendants', //  результат кладём в массив descendants
        },
      },
      //собираем все id в один массив:
      { $project: { ids: { $concatArrays: [['$_id'], '$descendants._id'] } } },
    ]);

    return (result || []).ids.map((id) => id.toString());
  }

  create(ownerId: string, dto: CreateContainerDto, rootId?: string) {
    return this.containerModel.create({
      ownerId,
      name: dto.name,
      kind: dto.kind ?? null,
      parentId: dto.parentId ?? null,
      rootId: rootId ?? null,
      ruleId: dto.ruleId ?? null,
    });
  }

  update(id: string, dto: UpdateContainerDto) {
    return this.containerModel.findByIdAndUpdate(id, dto, { new: true }).exec();
  }

  updateParent(id: string, parentId: string) {
    return this.containerModel
      .findByIdAndUpdate(id, { parentId }, { new: true })
      .exec();
  }

  delete(id: string) {
    return this.containerModel.findByIdAndDelete(id).exec();
  }

  setQrPending(id: string) {
    return this.containerModel
      .findOneAndUpdate(
        { _id: id, qrStatus: { $ne: 'pending' } },
        { $set: { qrStatus: 'pending' } },
        { new: true },
      )
      .exec();
  }

  setQrReady(id: string, key: string) {
    return this.containerModel
      .updateOne({ _id: id }, { $set: { qrStatus: 'ready', qrKey: key } })
      .exec();
  }

  setQrFailed(id: string) {
    return this.containerModel
      .updateOne({ _id: id }, { $set: { qrStatus: 'failed' } })
      .exec();
  }
}
