import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { validateEnvironment } from './config/env';
import { PrismaModule } from './database/prisma.module';
import { HealthModule } from './health/health.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env.local', '../../.env'],
      validate: validateEnvironment,
    }),
    PrismaModule,
    HealthModule,
    SubscriptionsModule,
  ],
})
export class AppModule {}
