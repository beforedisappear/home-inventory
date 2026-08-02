import { useState } from 'react';

import type { AnyFormApi } from '@tanstack/react-form';

import { fromCustomFieldsDto } from '@/services/item';

import type { components } from '@/kernel/api/schema';

import type { RecognitionDraftFieldKey } from '../ui/recognition-draft-confirm-modal';

type RecognitionDraftDto = components['schemas']['RecognitionDraftDto'];
type CategoryResponseDto = components['schemas']['CategoryResponseDto'];

export interface DraftConflict {
  key: RecognitionDraftFieldKey;
  label: string;
  currentPreview: string;
  draftPreview: string;
}

interface PendingRecognition {
  draft: RecognitionDraftDto;
  conflicts: DraftConflict[];
}

function applyField(
  form: AnyFormApi,
  key: RecognitionDraftFieldKey,
  draft: RecognitionDraftDto,
): void {
  switch (key) {
    case 'name':
      form.setFieldValue('name', draft.name);
      break;
    case 'description':
      if (draft.description)
        form.setFieldValue('description', draft.description);
      break;
    case 'categoryId':
      if (draft.categoryId) form.setFieldValue('categoryId', draft.categoryId);
      break;
    case 'customFields':
      form.setFieldValue(
        'customFields',
        fromCustomFieldsDto(draft.customFields),
      );
      break;
  }
}

// сравнивает draft с текущими значениями формы: непустые поля идут в conflicts
// (спросим юзера), пустые — заполняются сразу, без вопросов
function diffDraft(
  form: AnyFormApi,
  draft: RecognitionDraftDto,
  categories: CategoryResponseDto[] | undefined,
): DraftConflict[] {
  const conflicts: DraftConflict[] = [];

  const currentName = form.getFieldValue('name').trim();

  if (currentName) {
    conflicts.push({
      key: 'name',
      label: 'Название',
      currentPreview: currentName,
      draftPreview: draft.name,
    });
  } else {
    applyField(form, 'name', draft);
  }

  if (draft.description) {
    const currentDescription = form.getFieldValue('description').trim();
    if (currentDescription) {
      conflicts.push({
        key: 'description',
        label: 'Описание',
        currentPreview: currentDescription,
        draftPreview: draft.description,
      });
    } else {
      applyField(form, 'description', draft);
    }
  }

  if (draft.categoryId) {
    const currentCategoryId = form.getFieldValue('categoryId');
    if (currentCategoryId) {
      conflicts.push({
        key: 'categoryId',
        label: 'Категория',
        currentPreview:
          categories?.find(c => c.id === currentCategoryId)?.name ?? '—',
        draftPreview: draft.categoryName ?? '—',
      });
    } else {
      applyField(form, 'categoryId', draft);
    }
  }

  if (draft.customFields.length > 0) {
    const currentCustomFields = form.getFieldValue('customFields');
    if (currentCustomFields.length > 0) {
      conflicts.push({
        key: 'customFields',
        label: 'Доп. поля',
        currentPreview: `${currentCustomFields.length} полей`,
        draftPreview: `${draft.customFields.length} полей`,
      });
    } else {
      applyField(form, 'customFields', draft);
    }
  }

  return conflicts;
}

export function useRecognitionDraftMerge(
  form: AnyFormApi,
  categories: CategoryResponseDto[] | undefined,
) {
  const [pending, setPending] = useState<PendingRecognition | null>(null);

  const handleDraftReady = (draft: RecognitionDraftDto) => {
    const conflicts = diffDraft(form, draft, categories);

    if (conflicts.length > 0) setPending({ draft, conflicts });
  };

  const handleResolve = (selectedKeys: RecognitionDraftFieldKey[]) => {
    if (pending)
      selectedKeys.forEach(key => applyField(form, key, pending.draft));

    setPending(null);
  };

  return {
    conflicts: pending?.conflicts ?? null,
    handleDraftReady,
    handleResolve,
  };
}
