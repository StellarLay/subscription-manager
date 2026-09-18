import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { CategoriesModule } from './categories/categories.module';
import { validateEnvironment } from './config/env';
import { PrismaModule } from './database/prisma.module';
import { ExchangeRatesModule } from './exchange-rates/exchange-rates.module';
import { HealthModule } from './health/health.module';
import { PaymentMethodsModule } from './payment-methods/payment-methods.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env.local', '../../.env'],
      validate: validateEnvironment,
    }),
    PrismaModule,
    ExchangeRatesModule,
    UsersModule,
    HealthModule,
    CategoriesModule,
    PaymentMethodsModule,
    SubscriptionsModule,
  ],
})
export class AppModule {}
