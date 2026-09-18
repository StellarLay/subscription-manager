import { CreateCategoryBody } from '@subscription-manager/api-client';
import { describe, expect, it } from 'vitest';

describe('CreateCategoryBody', () => {
  it('accepts a category created by the form', () => {
    const result = CreateCategoryBody.safeParse({
      name: 'Развлечения',
      color: '#ff9b66',
      icon: 'ENTERTAINMENT',
    });

    expect(result.success).toBe(true);
  });

  it('rejects invalid category values', () => {
    const result = CreateCategoryBody.safeParse({
      name: '',
      color: 'orange',
      icon: 'UNKNOWN',
    });

    expect(result.success).toBe(false);
  });
});
