import { Archive, DoorOpen, Home, Inbox, Package, ShoppingBag } from 'lucide-react';

import type { components } from '@/kernel/api/schema';

type ContainerKind = components['schemas']['ContainerResponseDto']['kind'];

const CONTAINER_KIND_ICON = {
  room: DoorOpen,
  cabinet: Archive,
  drawer: Inbox,
  box: Package,
  bag: ShoppingBag,
} as const;

export function getContainerKindIcon(kind: ContainerKind) {
  return kind ? CONTAINER_KIND_ICON[kind] : Home;
}
