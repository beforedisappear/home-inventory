import { useEffect, useRef } from 'react';
import { Camera } from 'lucide-react';

import type { components } from '@/kernel/api/schema';

import { Button, Spinner, toast } from '@/shared/ui';

import { useRecognition } from '../model/use-recognition';

type RecognitionDraftDto = components['schemas']['RecognitionDraftDto'];

const ACCEPTED_MIME_TYPES = 'image/jpeg,image/png,image/webp';

interface Props {
  onDraftReady: (draft: RecognitionDraftDto, file: File) => void;
}

export function RecognitionPhotoField(props: Props) {
  const { onDraftReady } = props;

  const { status, draft, error, isStarting, start, cancel, reset } =
    useRecognition();

  const pendingFileRef = useRef<File | null>(null);

  useEffect(() => {
    if (status === 'ready' && draft && pendingFileRef.current) {
      onDraftReady(draft, pendingFileRef.current);
      pendingFileRef.current = null;
      reset();
    }

    if (status === 'failed') {
      toast.danger(error ?? 'Не удалось распознать вещь по фото');
      pendingFileRef.current = null;
      reset();
    }
  }, [status, draft, error, onDraftReady, reset]);

  const isActive = status === 'pending' || status === 'processing';

  const handleChange = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;

    pendingFileRef.current = file;
    void start(file);
  };

  return (
    <div className='flex items-center gap-2'>
      <label className='flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted transition-colors hover:border-primary hover:text-primary'>
        {isActive || isStarting ? <Spinner size='sm' /> : <Camera size={16} />}
        Заполнить по фото
        <input
          type='file'
          accept={ACCEPTED_MIME_TYPES}
          className='hidden'
          disabled={isActive || isStarting}
          onChange={e => {
            handleChange(e.target.files);
            e.target.value = '';
          }}
        />
      </label>

      {isActive && (
        <Button
          type='button'
          variant='ghost'
          size='sm'
          onPress={() => void cancel()}
        >
          Отмена
        </Button>
      )}
    </div>
  );
}
