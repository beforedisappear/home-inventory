import type { components } from '@/kernel/api/schema';

type ContainerKind = components['schemas']['ContainerResponseDto']['kind'];

const CONTAINER_KIND_LABEL = {
  room: 'Комната',
  cabinet: 'Шкаф',
  drawer: 'Ящик',
  box: 'Коробка',
  bag: 'Сумка',
} as const;

export const CONTAINER_KINDS = Object.keys(
  CONTAINER_KIND_LABEL,
) as (keyof typeof CONTAINER_KIND_LABEL)[];

export function getContainerKindLabel(kind: ContainerKind) {
  return kind ? CONTAINER_KIND_LABEL[kind] : null;
}
