export const DOCUMENT_TYPES = [
  'receipt',
  'warranty',
  'manual',
  'other',
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  receipt: 'Чек',
  warranty: 'Гарантия',
  manual: 'Инструкция',
  other: 'Другое',
};
