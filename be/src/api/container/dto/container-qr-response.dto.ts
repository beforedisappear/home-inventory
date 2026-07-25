import { IsIn, IsOptional, IsString } from 'class-validator';

import { QR_STATUSES, type QrStatus } from '../interfaces/qr.types';

export class ContainerQrResponseDto {
  @IsIn(QR_STATUSES)
  status: QrStatus;

  @IsOptional()
  @IsString()
  url: string | null;
}
