import { Settings } from 'lucide-react';

import { AdaptiveModal, Button, useOverlayState } from '@/shared/ui';

import { CategoryAdd } from './category-add';
import { CategoryManagerList } from './category-manager-list';

export function CategoryManager() {
  const state = useOverlayState();

  return (
    <>
      <Button
        type='button'
        isIconOnly
        variant='ghost'
        size='sm'
        aria-label='Управление категориями'
        onPress={state.open}
      >
        <Settings size={16} />
      </Button>

      <AdaptiveModal
        state={state}
        heading='Категории'
        headerAction={<CategoryAdd />}
      >
        <AdaptiveModal.Body>
          <CategoryManagerList />
        </AdaptiveModal.Body>
      </AdaptiveModal>
    </>
  );
}
