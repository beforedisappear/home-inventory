import { useState } from 'react';

import { useMutation } from '@tanstack/react-query';
import { FileText, Image as ImageIcon, Trash2 } from 'lucide-react';

import {
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPES,
  documentQueries,
  getWarrantyColorClass,
  type DocumentType,
} from '@/services/document';

import type { components } from '@/kernel/api/schema';

import {
  AlertDialog,
  Button,
  Chip,
  FormTextareaField,
  FormTextField,
  Input,
  Label,
  SelectField,
  Spinner,
  TextField,
  Typography,
  toast,
  useOverlayState,
} from '@/shared/ui';

import { useDocumentEditForm } from '../model/use-document-edit-form';

type DocumentResponseDto = components['schemas']['DocumentResponseDto'];

const TYPE_OPTIONS = DOCUMENT_TYPES.map(type => ({
  id: type,
  label: DOCUMENT_TYPE_LABELS[type],
}));

interface Props {
  doc: DocumentResponseDto;
}

export function DocumentCard(props: Props) {
  const { doc } = props;

  const [isExpanded, setIsExpanded] = useState(false);

  const deleteState = useOverlayState();

  const { form, resetToDoc, isSaving } = useDocumentEditForm({
    doc,
    onSaved: () => setIsExpanded(false),
  });

  const { mutateAsync: deleteDocument, isPending: isDeleting } = useMutation(
    documentQueries.delete(),
  );

  const handleToggleExpand = () => {
    if (isExpanded) {
      setIsExpanded(false);
      return;
    }

    resetToDoc();
    setIsExpanded(true);
  };

  const handleDelete = async () => {
    try {
      await deleteDocument({ id: doc.id, itemId: doc.itemId });
      deleteState.close();
    } catch {
      toast.danger('Не удалось удалить документ');
    }
  };

  const Icon = doc.file.mimeType === 'application/pdf' ? FileText : ImageIcon;
  const warrantyColorClass = getWarrantyColorClass(doc.warrantyEndsAt);
  const title = doc.name || `Документ (${DOCUMENT_TYPE_LABELS[doc.type]})`;

  return (
    <div className='flex flex-col gap-3 rounded-lg border border-border p-3'>
      <div className='flex items-center gap-3'>
        <a
          href={doc.file.url}
          target='_blank'
          rel='noreferrer'
          aria-label='Открыть файл'
          className='flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-secondary text-muted transition-colors hover:text-primary'
        >
          <Icon size={18} />
        </a>

        <button
          type='button'
          onClick={handleToggleExpand}
          className='flex flex-1 flex-col items-start gap-1 text-left'
        >
          <div className='flex items-center gap-2'>
            <Typography type='body-sm' weight='medium'>
              {title}
            </Typography>
            <Chip size='sm'>{DOCUMENT_TYPE_LABELS[doc.type]}</Chip>
          </div>

          {doc.warrantyEndsAt && (
            <Typography type='body-xs' className={warrantyColorClass}>
              Гарантия до{' '}
              {new Date(doc.warrantyEndsAt).toLocaleDateString('ru-RU')}
            </Typography>
          )}
        </button>

        <button
          type='button'
          aria-label='Удалить документ'
          onClick={deleteState.open}
          className='flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-secondary hover:text-danger'
        >
          <Trash2 size={16} />
        </button>
      </div>

      {isExpanded && (
        <form
          className='flex flex-col gap-3 border-t border-border pt-3'
          onSubmit={e => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <form.Field name='type'>
            {field => (
              <SelectField
                label='Тип'
                placeholder='Тип документа'
                value={field.state.value}
                onChange={value => field.handleChange(value as DocumentType)}
                options={TYPE_OPTIONS}
              />
            )}
          </form.Field>

          <form.Field name='name'>
            {field => <FormTextField field={field} label='Имя' />}
          </form.Field>

          <form.Field name='description'>
            {field => <FormTextareaField field={field} label='Описание' />}
          </form.Field>

          <form.Field name='warrantyEndsAt'>
            {field => (
              <TextField
                type='date'
                className='flex flex-col gap-1'
                value={field.state.value}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
              >
                <Label>Гарантия до</Label>
                <Input />
              </TextField>
            )}
          </form.Field>

          <div className='flex justify-end gap-2'>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onPress={() => setIsExpanded(false)}
            >
              Отмена
            </Button>
            <Button type='submit' size='sm' isDisabled={isSaving}>
              {isSaving ? <Spinner size='sm' /> : 'Сохранить'}
            </Button>
          </div>
        </form>
      )}

      <AlertDialog.Root
        isOpen={deleteState.isOpen}
        onOpenChange={deleteState.setOpen}
      >
        <AlertDialog.Backdrop>
          <AlertDialog.Container>
            <AlertDialog.Dialog>
              <div className='flex items-center gap-3'>
                <AlertDialog.Icon />
                <AlertDialog.Header className='mb-0'>
                  <AlertDialog.Heading>Удалить документ?</AlertDialog.Heading>
                </AlertDialog.Header>
              </div>
              <AlertDialog.Body className='mt-2'>
                Это действие нельзя отменить.
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button
                  type='button'
                  variant='ghost'
                  onPress={deleteState.close}
                >
                  Отмена
                </Button>
                <Button
                  type='button'
                  variant='danger'
                  isDisabled={isDeleting}
                  onPress={() => void handleDelete()}
                >
                  Удалить
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog.Root>
    </div>
  );
}
