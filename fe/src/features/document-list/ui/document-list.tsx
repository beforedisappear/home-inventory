import { useRef, useState } from 'react';

import { useMutation, useQuery } from '@tanstack/react-query';
import { FileStack, Plus } from 'lucide-react';

import { documentQueries } from '@/services/document';
import { itemQueries } from '@/services/item';

import {
  EmptyState,
  ErrorState,
  Spinner,
  Typography,
  toast,
} from '@/shared/ui';

import { DocumentCard } from './document-card';

const ACCEPTED_DOCUMENT_MIME_TYPES =
  'application/pdf,image/jpeg,image/png,image/webp';

interface Props {
  itemId: string;
}

export function DocumentList(props: Props) {
  const { itemId } = props;

  const { data: item } = useQuery(itemQueries.byId(itemId));

  const {
    data: documents,
    isPending,
    isError,
    refetch,
  } = useQuery({ ...documentQueries.byItem(itemId), enabled: !!item });

  const [uploadingCount, setUploadingCount] = useState(0);

  const { mutateAsync: uploadFile } = useMutation(documentQueries.uploadFile());
  const { mutateAsync: createDocument } = useMutation(documentQueries.create());

  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;

    Array.from(files).forEach(file => {
      setUploadingCount(count => count + 1);

      uploadFile(file)
        .then(uploaded =>
          createDocument({ itemId, type: 'other', fileKey: uploaded.key }),
        )
        .catch(() => {
          toast.danger(`Не удалось загрузить документ: ${file.name}`);
        })
        .finally(() => {
          setUploadingCount(count => count - 1);
        });
    });
  };

  if (isPending) {
    return (
      <div className='flex w-full items-center justify-center py-6'>
        <Spinner />
      </div>
    );
  }

  return (
    <div className='flex w-full flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-xl sm:p-6 md:p-10'>
      <div className='flex items-center justify-between'>
        <Typography type='h4'>Документы</Typography>

        <button
          type='button'
          onClick={() => inputRef.current?.click()}
          className='flex items-center gap-1 text-sm text-primary hover:underline'
        >
          <Plus size={16} />
          Добавить документ
        </button>

        <input
          ref={inputRef}
          type='file'
          accept={ACCEPTED_DOCUMENT_MIME_TYPES}
          multiple
          className='hidden'
          onChange={e => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {isError && (
        <ErrorState onRetry={() => refetch()}>
          Не удалось загрузить документы
        </ErrorState>
      )}

      {!isError && documents && (
        <div className='flex flex-col gap-2'>
          {documents.map(doc => (
            <DocumentCard key={doc.id} doc={doc} />
          ))}

          {Array.from({ length: uploadingCount }).map((_, index) => (
            <div
              key={`pending-${index}`}
              className='flex h-16 items-center justify-center rounded-lg border border-dashed border-border'
            >
              <Spinner size='sm' />
            </div>
          ))}

          {documents.length === 0 && uploadingCount === 0 && (
            <EmptyState icon={FileStack}>Документов пока нет</EmptyState>
          )}
        </div>
      )}
    </div>
  );
}
