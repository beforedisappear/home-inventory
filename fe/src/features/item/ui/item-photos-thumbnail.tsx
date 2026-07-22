import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from 'lucide-react';

import type { components } from '@/kernel/api/schema';

import { cn } from '@/shared/lib/cn';

type ItemPhotoResponseDto = components['schemas']['ItemPhotoResponseDto'];

interface ThumbnailProps {
  photo: ItemPhotoResponseDto;
  onOpen: () => void;
  onDelete: () => void;
}

export function ItemPhotoThumbnail(props: ThumbnailProps) {
  const { photo, onOpen, onDelete } = props;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: photo.key });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group relative size-24 shrink-0 overflow-hidden rounded-lg border border-border',
        isDragging && 'opacity-50',
      )}
    >
      <button type='button' onClick={onOpen} className='size-full'>
        <img src={photo.url} alt='' className='size-full object-cover' />
      </button>

      <button
        type='button'
        aria-label='Переместить фото'
        {...attributes}
        {...listeners}
        className='absolute left-1 top-1 flex size-6 cursor-grab items-center justify-center rounded-full bg-surface/80 text-muted opacity-0 transition-opacity active:cursor-grabbing group-hover:opacity-100'
      >
        <GripVertical size={14} />
      </button>

      <button
        type='button'
        aria-label='Удалить фото'
        onClick={onDelete}
        className='absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-surface/80 text-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100'
      >
        <X size={14} />
      </button>
    </div>
  );
}
