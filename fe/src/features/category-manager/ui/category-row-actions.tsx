import { useState } from 'react';

import { Popover } from '@heroui/react';
import { Pencil, Trash2 } from 'lucide-react';

import { useDeleteCategory } from '../model/use-delete-category';
import { useUpdateCategory } from '../model/use-update-category';
import { CategoryDeleteConfirm } from './category-delete-confirm';
import { CategoryNameForm } from './category-name-form';

interface Props {
  categoryId: string;
  categoryName: string;
}

export function CategoryRowActions(props: Props) {
  const { categoryId, categoryName } = props;

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const { handleUpdate } = useUpdateCategory();
  const { handleDelete } = useDeleteCategory();

  return (
    <div className='flex shrink-0 items-center gap-1'>
      <Popover.Root isOpen={isEditOpen} onOpenChange={setIsEditOpen}>
        <Popover.Trigger
          aria-label='Редактировать категорию'
          className='flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-secondary hover:text-foreground'
        >
          <Pencil size={16} />
        </Popover.Trigger>

        <Popover.Content>
          <Popover.Dialog>
            <CategoryNameForm
              initialName={categoryName}
              submitLabel='Сохранить'
              onSave={name => handleUpdate(categoryId, name)}
              onClose={() => setIsEditOpen(false)}
            />
          </Popover.Dialog>
        </Popover.Content>
      </Popover.Root>

      <Popover.Root isOpen={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <Popover.Trigger
          aria-label='Удалить категорию'
          className='flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-secondary hover:text-danger'
        >
          <Trash2 size={16} />
        </Popover.Trigger>

        <Popover.Content>
          <Popover.Dialog>
            <CategoryDeleteConfirm
              name={categoryName}
              onConfirm={() => handleDelete(categoryId)}
              onClose={() => setIsDeleteOpen(false)}
            />
          </Popover.Dialog>
        </Popover.Content>
      </Popover.Root>
    </div>
  );
}
