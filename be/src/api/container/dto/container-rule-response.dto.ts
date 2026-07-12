import {
  IsArray,
  IsBoolean,
  IsDate,
  IsMongoId,
  IsString,
} from 'class-validator';

import { KindRuleDto } from './kind-rule.dto';

export class ContainerRuleResponseDto {
  @IsMongoId()
  id: string;

  @IsString()
  name: string;

  @IsBoolean()
  isSystem: boolean;

  @IsArray()
  kindRules: KindRuleDto[];

  @IsDate()
  createdAt: Date;

  @IsDate()
  updatedAt: Date;
}
