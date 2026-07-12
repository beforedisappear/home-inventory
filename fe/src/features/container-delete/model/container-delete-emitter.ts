import { EventEmitter } from '@/shared/lib/event-emitter';

export interface ContainerDeleteRequest {
  containerId: string;
  parentId: string | null;
  containerName: string;
  onDeleted?: () => void;
}

type ContainerDeleteEvents = {
  open: ContainerDeleteRequest;
};

export const containerDeleteEmitter = new EventEmitter<ContainerDeleteEvents>();
