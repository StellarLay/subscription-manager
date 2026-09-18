import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { CategoryIcon, CreateCategoryDto } from './create-category.dto';

describe('CreateCategoryDto', () => {
  it('accepts a valid category', async () => {
    const input = plainToInstance(CreateCategoryDto, {
      name: 'Развлечения',
      color: '#ff9b66',
      icon: CategoryIcon.ENTERTAINMENT,
    });

    await expect(validate(input)).resolves.toHaveLength(0);
  });

  it('rejects invalid color and icon values', async () => {
    const input = plainToInstance(CreateCategoryDto, {
      name: '',
      color: 'orange',
      icon: 'UNKNOWN',
    });

    const errors = await validate(input);

    expect(errors.map(({ property }) => property).sort()).toEqual(['color', 'icon', 'name']);
  });
});
