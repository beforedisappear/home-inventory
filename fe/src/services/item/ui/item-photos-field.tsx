import { forwardRef, useImperativeHandle, useState } from 'react';

import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import type { AnyFieldApi } from '@tanstack/react-form';
import { useIsMutating, useMutation } from '@tanstack/react-query';
import { Plus } from 'lucide-react';

import { itemQueries } from '@/services/item';

import type { components } from '@/kernel/api/schema';

import { Label, PhotoLightbox, Spinner, toast } from '@/shared/ui';

import { ItemPhotoThumbnail } from './item-photos-thumbnail';

type ItemPhotoResponseDto = components['schemas']['ItemPhotoResponseDto'];

const ACCEPTED_PHOTO_MIME_TYPES = 'image/jpeg,image/png,image/webp';

interface Props {
  field: AnyFieldApi;
  initialPhotos: ItemPhotoResponseDto[];
}

export interface ItemPhotosFieldHandle {
  addFiles: (files: File[]) => void;
}

export const ItemPhotosField = forwardRef<ItemPhotosFieldHandle, Props>(
  function ItemPhotosField(props, ref) {
    const { field, initialPhotos } = props;

    const [photoMeta, setPhotoMeta] = useState<
      Record<string, ItemPhotoResponseDto>
    >(() => Object.fromEntries(initialPhotos.map(photo => [photo.key, photo])));

    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

    const { mutateAsync: uploadPhoto } = useMutation(itemQueries.uploadPhoto());

    const pendingCount = useIsMutating({
      mutationKey: itemQueries.uploadPhotoKey(),
    });

    const sensors = useSensors(
      useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    );

    const handleFiles = (files: File[]) => {
      files.forEach(file => {
        uploadPhoto(file)
          .then(photo => {
            setPhotoMeta(meta => ({ ...meta, [photo.key]: photo }));
            field.handleChange((keys: string[]) => [...keys, photo.key]);
          })
          .catch(() => {
            toast.danger(`Не удалось загрузить фото: ${file.name}`);
          });
      });
    };

    useImperativeHandle(ref, () => ({ addFiles: handleFiles }));

    const handleFilesSelected = (files: FileList | null) => {
      if (!files) return;
      handleFiles(Array.from(files));
    };

    const handleDelete = (key: string) => {
      field.handleChange((keys: string[]) => keys.filter(k => k !== key));
    };

    const handleDragEnd = (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || active.id === over.id) return;

      field.handleChange((keys: string[]) => {
        const oldIndex = keys.indexOf(String(active.id));
        const newIndex = keys.indexOf(String(over.id));

        return arrayMove(keys, oldIndex, newIndex);
      });
    };

    const attachedKeys: string[] = field.state.value;

    const attachedPhotos = attachedKeys
      .map(key => photoMeta[key])
      .filter((photo): photo is ItemPhotoResponseDto => Boolean(photo));

    return (
      <div className='flex flex-col gap-2'>
        <Label>Фото</Label>

        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext items={attachedKeys} strategy={rectSortingStrategy}>
            <div className='flex flex-wrap gap-3'>
              {attachedKeys.map((key, index) => {
                const photo = photoMeta[key];

                if (!photo) return null;

                return (
                  <ItemPhotoThumbnail
                    key={key}
                    photo={photo}
                    onOpen={() => setLightboxIndex(index)}
                    onDelete={() => handleDelete(key)}
                  />
                );
              })}

              {Array.from({ length: pendingCount }).map((_, index) => (
                <div
                  key={`pending-${index}`}
                  className='flex size-24 shrink-0 items-center justify-center rounded-lg border border-border'
                >
                  <Spinner size='sm' />
                </div>
              ))}

              <label className='flex size-24 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-dashed border-border text-muted transition-colors hover:border-primary hover:text-primary'>
                <Plus size={20} />

                <input
                  type='file'
                  accept={ACCEPTED_PHOTO_MIME_TYPES}
                  multiple
                  className='hidden'
                  onChange={e => {
                    handleFilesSelected(e.target.files);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </SortableContext>
        </DndContext>

        {lightboxIndex !== null && (
          <PhotoLightbox
            photos={attachedPhotos}
            index={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
            onNavigate={setLightboxIndex}
          />
        )}
      </div>
    );
  },
);
