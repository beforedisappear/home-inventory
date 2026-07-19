import { OmitType, PartialType } from '@nestjs/swagger';

import { IsMongoId, IsOptional } from 'class-validator';

import { CreateItemDto } from './create-item.dto';

export class UpdateItemDto extends PartialType(
  OmitType(CreateItemDto, ['categoryId'] as const),
) {
  @IsOptional()
  @IsMongoId()
  categoryId?: string | null;
}
