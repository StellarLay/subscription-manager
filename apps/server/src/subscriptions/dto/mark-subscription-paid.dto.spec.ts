import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { MarkSubscriptionPaidDto } from './mark-subscription-paid.dto';

describe('MarkSubscriptionPaidDto', () => {
  it('accepts an ISO calendar date', async () => {
    const input = Object.assign(new MarkSubscriptionPaidDto(), { scheduledFor: '2026-09-19' });

    await expect(validate(input)).resolves.toHaveLength(0);
  });

  it('rejects a non-date value', async () => {
    const input = Object.assign(new MarkSubscriptionPaidDto(), { scheduledFor: 'tomorrow' });

    expect(await validate(input)).not.toHaveLength(0);
  });

  it('rejects a timestamp because the API accepts a calendar date only', async () => {
    const input = Object.assign(new MarkSubscriptionPaidDto(), {
      scheduledFor: '2026-09-19T10:00:00.000Z',
    });

    expect(await validate(input)).not.toHaveLength(0);
  });
});
