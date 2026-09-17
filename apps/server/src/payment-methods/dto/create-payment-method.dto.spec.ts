import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { PaymentMethodType } from '../../generated/prisma/client';
import { CreatePaymentMethodDto } from './create-payment-method.dto';

describe('CreatePaymentMethodDto', () => {
  it('accepts safe card metadata', async () => {
    const input = plainToInstance(CreatePaymentMethodDto, {
      name: 'Тинькофф Black',
      type: PaymentMethodType.CARD,
      lastFour: '4242',
      color: '#73ff5b',
    });

    await expect(validate(input)).resolves.toHaveLength(0);
  });

  it('rejects a full card number and invalid color', async () => {
    const input = plainToInstance(CreatePaymentMethodDto, {
      name: '',
      type: 'CASH',
      lastFour: '2200123412341234',
      color: 'green',
    });

    const errors = await validate(input);

    expect(errors.map(({ property }) => property).sort()).toEqual([
      'color',
      'lastFour',
      'name',
      'type',
    ]);
  });
});
