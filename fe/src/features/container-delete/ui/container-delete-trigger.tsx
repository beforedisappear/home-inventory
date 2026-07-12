import { Trash2 } from 'lucide-react';

import type { ContainerDeleteRequest } from '../model/container-delete-emitter';
import { containerDeleteEmitter } from '../model/container-delete-emitter';

type Props = ContainerDeleteRequest;

export function ContainerDeleteTrigger(props: Props) {
  return (
    <button
      type='button'
      aria-label='Удалить контейнер'
      className='flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-secondary hover:text-danger'
      onClick={() => containerDeleteEmitter.emit('open', props)}
    >
      <Trash2 size={16} />
    </button>
  );
}
