import { BullModule } from '@nestjs/bullmq';
import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { BullBoardModule } from '@bull-board/nestjs';

import { ItemModule } from '@/api/item/item.module';
import { InfraModule } from '@/infra/infra.module';
import { LibsModule } from '@/libs/libs.module';

import { CONTAINER_QR_QUEUE } from './constants/container-qr-queue';
import { ContainerRuleController } from './controllers/container-rule.controller';
import { ContainerController } from './controllers/container.controller';
import { ContainerQrGenerateProcessor } from './processors/container-qr-generate.processor';
import { ContainerRuleRepository } from './repositories/container-rule.repository';
import { ContainerRepository } from './repositories/container.repository';
import {
  ContainerRule,
  ContainerRuleSchema,
} from './schemas/container-rule.schema';
import { Container, ContainerSchema } from './schemas/container.schema';
import { ContainerQrService } from './services/container-qr.service';
import { ContainerRuleSeedService } from './services/container-rule-seed.service';
import { ContainerRuleService } from './services/container-rule.service';
import { ContainerService } from './services/container.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Container.name, schema: ContainerSchema },
      { name: ContainerRule.name, schema: ContainerRuleSchema },
    ]),
    InfraModule,
    LibsModule,
    forwardRef(() => ItemModule),
    BullModule.registerQueue({ name: CONTAINER_QR_QUEUE }),
    BullBoardModule.forFeature({
      name: CONTAINER_QR_QUEUE,
      adapter: BullMQAdapter,
    }),
  ],
  controllers: [ContainerController, ContainerRuleController],
  providers: [
    ContainerService,
    ContainerRepository,
    ContainerRuleService,
    ContainerRuleSeedService,
    ContainerRuleRepository,
    ContainerQrService,
    ContainerQrGenerateProcessor,
  ],
  exports: [ContainerService],
})
export class ContainerModule {}
