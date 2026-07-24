import { useState } from 'react';

import { Popover } from '@heroui/react';
import { Plus } from 'lucide-react';

import { useCreateCategory } from '../model/use-create-category';
import { CategoryNameForm } from './category-name-form';

export function CategoryAdd() {
  const [isOpen, setIsOpen] = useState(false);

  const { handleCreate } = useCreateCategory();

  return (
    <Popover.Root isOpen={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger
        aria-label='Добавить категорию'
        className='flex size-8 items-center justify-center rounded-lg text-primary transition-colors hover:bg-surface-secondary'
      >
        <Plus size={16} />
      </Popover.Trigger>

      <Popover.Content>
        <Popover.Dialog>
          <CategoryNameForm
            initialName=''
            submitLabel='Добавить'
            onSave={handleCreate}
            onClose={() => setIsOpen(false)}
          />
        </Popover.Dialog>
      </Popover.Content>
    </Popover.Root>
  );
}
