import { useState } from 'react';

import {
  AdaptiveModal,
  Button,
  Checkbox,
  Typography,
  useOverlayState,
} from '@/shared/ui';

export type RecognitionDraftFieldKey =
  | 'name'
  | 'description'
  | 'categoryId'
  | 'customFields';

export interface RecognitionDraftConflict {
  key: RecognitionDraftFieldKey;
  label: string;
  currentPreview: string;
  draftPreview: string;
}

interface Props {
  conflicts: RecognitionDraftConflict[];
  onConfirm: (selectedKeys: RecognitionDraftFieldKey[]) => void;
}

export function RecognitionDraftConfirmModal(props: Props) {
  const { conflicts, onConfirm } = props;

  const state = useOverlayState({
    defaultOpen: true,
    onOpenChange: isOpen => {
      if (!isOpen) onConfirm([]);
    },
  });

  const [selected, setSelected] = useState<Set<RecognitionDraftFieldKey>>(
    () => new Set(conflicts.map(c => c.key)),
  );

  const toggle = (key: RecognitionDraftFieldKey, isSelected: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);

      if (isSelected) next.add(key);
      else next.delete(key);

      return next;
    });
  };

  return (
    <AdaptiveModal state={state} heading='Распознавание готово'>
      <AdaptiveModal.Body className='flex flex-col gap-3'>
        <Typography type='body-sm' color='muted'>
          Эти поля уже заполнены — выберите, что заменить результатом
          распознавания
        </Typography>

        {conflicts.map(conflict => (
          <div key={conflict.key} className='flex flex-col gap-0.5'>
            <Checkbox.Root
              isSelected={selected.has(conflict.key)}
              onChange={isSelected => toggle(conflict.key, isSelected)}
            >
              <Checkbox.Content>
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                {conflict.label}
              </Checkbox.Content>
            </Checkbox.Root>

            <Typography type='body-sm' color='muted' className='pl-6'>
              «{conflict.currentPreview}» → «{conflict.draftPreview}»
            </Typography>
          </div>
        ))}
      </AdaptiveModal.Body>

      <AdaptiveModal.Footer>
        <Button type='button' variant='ghost' onPress={() => onConfirm([])}>
          Пропустить всё
        </Button>
        <Button type='button' onPress={() => onConfirm([...selected])}>
          Применить
        </Button>
      </AdaptiveModal.Footer>
    </AdaptiveModal>
  );
}
