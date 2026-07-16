import type { ReactNode } from 'react';

import { Plus } from 'lucide-react';

import { useQuery } from '@tanstack/react-query';

import { containerRuleQueries } from '@/services/container-rule';

import { Button, Spinner, useOverlayState } from '@/shared/ui';

import { CreateContainerForm } from './create-container-form';
import { CreateContainerModal } from './create-container-modal';

interface Props {
  parentId: string | null;
  renderRuleField?: (props: {
    value: string;
    onChange: (ruleId: string) => void;
    onRequestClose: () => void;
  }) => ReactNode;
}

export function CreateContainer({ parentId, renderRuleField }: Props) {
  const state = useOverlayState();

  // список правил нужен только для root-контейнера (submit-дефолт в
  // use-create-container-form.ts); дальше по дереву прокидывается пропсом
  const { data: rules, isLoading: isRulesLoading } = useQuery({
    ...containerRuleQueries.list(),
    enabled: parentId === null,
  });

  return (
    <>
      <Button
        type='button'
        isIconOnly
        size='sm'
        aria-label='Добавить контейнер'
        onPress={state.open}
      >
        <Plus size={16} />
      </Button>

      <CreateContainerModal state={state}>
        {parentId === null && isRulesLoading ? (
          <Spinner className='m-auto' />
        ) : (
          <CreateContainerForm
            parentId={parentId}
            onSuccess={state.close}
            onRequestClose={state.close}
            rules={rules}
            renderRuleField={renderRuleField}
          />
        )}
      </CreateContainerModal>
    </>
  );
}
