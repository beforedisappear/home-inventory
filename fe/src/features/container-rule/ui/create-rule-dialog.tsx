import { useEvent } from '@/shared/lib/event-emitter';
import { AdaptiveDrawer, useOverlayState } from '@/shared/ui';

import { createRuleEmitter } from '../model/create-rule-emitter';
import { CreateRuleForm } from './create-rule-form';

// singleton-дровер: один на всё приложение, открывается по событию,
// а не рендерится инстансом на каждый вызывающий компонент (см. ContainerDeleteDialog)
export function CreateRuleDialog() {
  const state = useOverlayState();

  useEvent(createRuleEmitter, 'open', state.open);

  return (
    <AdaptiveDrawer
      state={state}
      heading='Новое правило'
      dialogClassName='sm:w-2/5'
    >
      <CreateRuleForm onCreated={state.close} onCancel={state.close} />
    </AdaptiveDrawer>
  );
}
