import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { ItemService } from '@/api/item/services/item.service';
import { StorageService } from '@/libs/storage/storage.service';

import { CreateContainerDto } from '../dto/create-container.dto';
import { MoveContainerDto } from '../dto/move-container.dto';
import { UpdateContainerDto } from '../dto/update-container.dto';
import { ContainerMapper } from '../mappers/container.mapper';
import { ContainerRepository } from '../repositories/container.repository';
import type { ContainerRuleDocument } from '../schemas/container-rule.schema';
import type { ContainerKind } from '../schemas/container.schema';
import { ContainerQrService } from './container-qr.service';
import { ContainerRuleService } from './container-rule.service';

@Injectable()
export class ContainerService {
  constructor(
    private readonly repo: ContainerRepository,
    private readonly ruleService: ContainerRuleService,
    private readonly storage: StorageService,
    private readonly qrService: ContainerQrService,

    // forwardRef из-за circular dep: ItemService инжектит ContainerService
    @Inject(forwardRef(() => ItemService))
    private readonly itemService: ItemService,
  ) {}

  /** Прямые дети уровня. parentId === null → root-контейнеры */
  async findChildren(ownerId: string, parentId: string | null) {
    const containers = await this.repo.findChildrenByOwner(ownerId, parentId);

    return containers.map((c) => ContainerMapper.toResponseDto(c));
  }

  async findById(ownerId: string, id: string) {
    const container = await this.repo.findById(id);

    if (!container || container.ownerId.toString() !== ownerId)
      throw new NotFoundException('Container not found');

    return ContainerMapper.toResponseDto(container);
  }

  async create(ownerId: string, dto: CreateContainerDto) {
    const isRoot = !dto.parentId;

    if (isRoot) {
      if (dto.kind)
        throw new BadRequestException('kind invalid for the root container');

      if (dto.ruleId) {
        await this.ruleService.findDocumentById(ownerId, dto.ruleId);
      }

      const created = await this.repo.create(ownerId, dto);

      return ContainerMapper.toResponseDto(created);
    }

    if (!dto.kind)
      throw new BadRequestException('kind is required for child containers');

    if (dto.ruleId)
      throw new BadRequestException(
        'ruleId is not allowed for child containers',
      );

    // parent существует и принадлежит этому юзеру
    const parent = await this.repo.findById(dto.parentId!);

    if (!parent) throw new NotFoundException('Parent not found');

    if (parent.ownerId.toString() !== ownerId)
      throw new ForbiddenException('Parent not found');

    const rootId = parent.rootId?.toString() ?? parent._id.toString();

    const rule = parent.ruleId
      ? await this.ruleService.findDocumentById(
          ownerId,
          parent.ruleId.toString(),
        )
      : null;

    this.assertPlacementAllowed(dto.kind, parent.kind, rule);

    const created = await this.repo.create(
      ownerId,
      {
        ...dto,
        ruleId: parent.ruleId?.toString() ?? undefined,
      },
      rootId,
    );

    return ContainerMapper.toResponseDto(created);
  }

  async update(ownerId: string, id: string, dto: UpdateContainerDto) {
    // проверка существования + owner
    await this.findById(ownerId, id);

    const updated = await this.repo.update(id, dto);

    return ContainerMapper.toResponseDto(updated!);
  }

  async delete(ownerId: string, id: string) {
    const container = await this.repo.findById(id);

    if (!container || container.ownerId.toString() !== ownerId)
      throw new ForbiddenException('Container not found');

    // не пускаем удалять не-пустой контейнер — юзер должен сначала разобрать содержимое
    const childrenCount = await this.repo.countChildren(id);

    if (childrenCount > 0)
      throw new ConflictException(
        `Container has ${childrenCount} child container(s)`,
      );

    const hasItems = await this.itemService.existsByContainer(id);

    if (hasItems)
      throw new ConflictException('Container is not empty (has items)');

    await this.qrService.deleteIfExists(container.qrKey);

    await this.repo.delete(id);

    return { id };
  }

  async getQr(ownerId: string, id: string) {
    const container = await this.repo.findById(id);

    if (!container || container.ownerId.toString() !== ownerId)
      throw new NotFoundException('Container not found');

    if (!container.kind)
      throw new BadRequestException('QR is not available for root containers');

    return ContainerMapper.toQrResponseDto(container, this.storage.buildUrl);
  }

  async generateQr(ownerId: string, id: string) {
    const container = await this.repo.findById(id);

    if (!container || container.ownerId.toString() !== ownerId)
      throw new NotFoundException('Container not found');

    if (!container.kind)
      throw new BadRequestException('QR is not available for root containers');

    await this.qrService.enqueueGenerate(id, ownerId);

    container.qrStatus = 'pending';

    return ContainerMapper.toQrResponseDto(container, this.storage.buildUrl);
  }

  async move(ownerId: string, id: string, dto: MoveContainerDto) {
    const node = await this.repo.findById(id);

    if (!node) throw new NotFoundException('Container not found');

    if (node.ownerId.toString() !== ownerId)
      throw new ForbiddenException('Yor not allowed to move this container');

    if (!node.parentId)
      throw new BadRequestException(
        'Root container cannot be moved (delete and recreate instead)',
      );

    if (id === dto.parentId)
      throw new BadRequestException('Cannot move container into itself');

    const newParent = await this.repo.findById(dto.parentId);

    if (!newParent) throw new NotFoundException('New parent not found');

    if (newParent.ownerId.toString() !== ownerId)
      throw new ForbiddenException('Yor not allowed to move this container');

    // берём всё поддерево перемещаемого контейнера: сам node + все descendants
    const subtreeIds = await this.repo.findSubtreeIds(id);

    // защита от цикла: новый parent не должен быть внутри этого поддерева
    if (subtreeIds.includes(dto.parentId))
      throw new BadRequestException(
        'Cannot move container into its own descendant',
      );

    const currentRootId = node.rootId?.toString();

    const newParentRootId =
      newParent.rootId?.toString() ?? newParent._id.toString();

    if (!currentRootId) throw new NotFoundException('Container tree is broken');

    if (currentRootId !== newParentRootId)
      throw new BadRequestException('Cannot move container to another root');

    const newRuleId = newParent.ruleId?.toString() ?? null;

    // загружаем rule нового parent. Если newParent.ruleId === null, ограничений нет.
    const newRule = newRuleId
      ? await this.ruleService.findDocumentById(ownerId, newRuleId)
      : null;

    // проверяем можно ли node.kind положить в newParent.kind.
    this.assertPlacementAllowed(node.kind!, newParent.kind, newRule);

    await this.repo.updateParent(id, dto.parentId);

    return this.findById(ownerId, id);
  }

  private assertPlacementAllowed(
    nodeKind: ContainerKind,
    parentKind: ContainerKind | null,
    rule: ContainerRuleDocument | null,
  ): void {
    if (!rule) return;

    const kindRule = rule.kindRules.find((item) => item.kind === nodeKind);

    if (!kindRule)
      throw new BadRequestException(
        `Container kind "${nodeKind}" is not allowed by rule "${rule.name}"`,
      );

    // parentKind === null означает, что parent — root-контейнер без kind.
    if (!parentKind) {
      // для root проверяем отдельный флаг: можно ли класть childKind прямо в root.
      if (kindRule.canBeInsideRoot) return;

      throw new BadRequestException(
        `Container kind "${nodeKind}" is not allowed inside root by rule "${rule.name}"`,
      );
    }

    // проверяем входит ли kind родительского контейнера в allowedParents
    if (kindRule.allowedParents.includes(parentKind)) return;

    // Если parent.kind не входит в allowedParents, вложение запрещено.
    throw new BadRequestException(
      `Container kind "${nodeKind}" is not allowed inside "${parentKind}" by rule "${rule.name}"`,
    );
  }
}
