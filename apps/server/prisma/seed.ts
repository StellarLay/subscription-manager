import { PrismaPg } from '@prisma/adapter-pg';

import {
  BillingPeriod,
  NotificationChannel,
  PaymentMethodType,
  PrismaClient,
} from '../src/generated/prisma/client';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required to seed the database');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const user = await prisma.user.upsert({
    where: { email: 'demo@subscription-manager.local' },
    update: {},
    create: {
      email: 'demo@subscription-manager.local',
      displayName: 'Demo User',
    },
  });

  const existingPaymentMethod = await prisma.paymentMethod.findFirst({
    where: { userId: user.id, name: 'Основная карта' },
  });

  const paymentMethod =
    existingPaymentMethod ??
    (await prisma.paymentMethod.create({
      data: {
        userId: user.id,
        name: 'Основная карта',
        type: PaymentMethodType.CARD,
        lastFour: '4242',
        color: '#6d5dfc',
      },
    }));

  const existingPayment = await prisma.recurringPayment.findFirst({
    where: { userId: user.id, name: 'Облачное хранилище' },
  });

  if (existingPayment) {
    return;
  }

  const nextChargeDate = new Date();
  nextChargeDate.setUTCDate(nextChargeDate.getUTCDate() + 6);
  nextChargeDate.setUTCHours(0, 0, 0, 0);

  await prisma.recurringPayment.create({
    data: {
      userId: user.id,
      paymentMethodId: paymentMethod.id,
      name: 'Облачное хранилище',
      category: 'Облака',
      amount: '699.00',
      currency: 'RUB',
      billingPeriod: BillingPeriod.MONTH,
      nextChargeDate,
      reminderRules: {
        create: {
          channel: NotificationChannel.EMAIL,
          daysBefore: 1,
          timeOfDayMinutes: 600,
        },
      },
    },
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
