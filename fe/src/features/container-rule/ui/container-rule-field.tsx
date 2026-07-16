import { useQuery } from '@tanstack/react-query';

import { containerRuleQueries } from '@/services/container-rule';

import { Button, Typography } from '@/shared/ui';

import { createRuleEmitter } from '../model/create-rule-emitter';
import { RuleSelect } from './rule-select';

interface Props {
  value: string;
  onChange: (ruleId: string) => void;
  onRequestClose: () => void;
}

// value === '' значит "нет правила" — тот же контракт, что у CreateContainerDto.ruleId.
// Дефолт (системное правило) уже подставлен в use-create-container-form.ts —
// сюда приходит реальное значение формы, без визуальных прослоек.
// Публичный компонент фичи: остальные файлы этого слайса — детали реализации.
export function ContainerRuleField({ value, onChange, onRequestClose }: Props) {
  const { data: rules = [] } = useQuery(containerRuleQueries.list());

  return (
    <div className='flex flex-col gap-1'>
      <Typography type='body-sm' color='muted'>
        Правило размещения
      </Typography>

      <RuleSelect rules={rules} value={value} onChange={onChange} />

      <Button
        type='button'
        variant='ghost'
        size='sm'
        className='self-start'
        onPress={() => {
          onRequestClose();
          createRuleEmitter.emit('open', undefined);
        }}
      >
        + Создать своё правило
      </Button>
    </div>
  );
}
