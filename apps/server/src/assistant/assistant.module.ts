import { Module } from '@nestjs/common';

import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { AiModelClient } from './model.client';

@Module({
  imports: [SubscriptionsModule],
  controllers: [AssistantController],
  providers: [AssistantService, AiModelClient],
})
export class AssistantModule {}
