export const QR_STATUSES = ['none', 'pending', 'ready', 'failed'] as const;

export type QrStatus = (typeof QR_STATUSES)[number];
