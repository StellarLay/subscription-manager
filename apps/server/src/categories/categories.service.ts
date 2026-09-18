import { ConflictException, Injectable } from '@nestjs/common';

import type { Category } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CurrentUserService } from '../users/current-user.service';
import { CategoryResponseDto } from './dto/category-response.dto';
import { CreateCategoryDto } from './dto/create-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentUser: CurrentUserService,
  ) {}

  async findAll(): Promise<CategoryResponseDto[]> {
    const userId = await this.currentUser.getId();
    const categories = await this.prisma.category.findMany({
      where: { userId, archivedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return categories.map((category) => this.toResponse(category));
  }

  async create(input: CreateCategoryDto): Promise<CategoryResponseDto> {
    const userId = await this.currentUser.getId();
    const name = input.name.trim();
    const existingCategory = await this.prisma.category.findFirst({
      where: { userId, name },
      select: { id: true },
    });

    if (existingCategory) {
      throw new ConflictException('Category already exists');
    }

    const category = await this.prisma.category.create({
      data: {
        userId,
        name,
        color: input.color,
        icon: input.icon,
      },
    });

    return this.toResponse(category);
  }

  private toResponse(category: Category): CategoryResponseDto {
    return {
      id: category.id,
      name: category.name,
      color: category.color,
      icon: category.icon as CategoryResponseDto['icon'],
      createdAt: category.createdAt.toISOString(),
    };
  }
}
