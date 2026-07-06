import type { components } from '@/kernel/api/schema';

type ContainerKind = components['schemas']['ContainerResponseDto']['kind'];

const CONTAINER_KIND_LABEL = {
  room: 'Комната',
  cabinet: 'Шкаф',
  drawer: 'Ящик',
  box: 'Коробка',
  bag: 'Сумка',
} as const;

export function getContainerKindLabel(kind: ContainerKind) {
  return kind ? CONTAINER_KIND_LABEL[kind] : null;
}
