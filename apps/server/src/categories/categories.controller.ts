import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBody, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CategoriesService } from './categories.service';
import { CategoryResponseDto } from './dto/category-response.dto';
import { CreateCategoryDto } from './dto/create-category.dto';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({ operationId: 'getCategories', summary: 'Get current user categories' })
  @ApiOkResponse({ isArray: true, type: CategoryResponseDto })
  getCategories(): Promise<CategoryResponseDto[]> {
    return this.categoriesService.findAll();
  }

  @Post()
  @ApiOperation({ operationId: 'createCategory', summary: 'Create a category' })
  @ApiBody({ type: CreateCategoryDto })
  @ApiCreatedResponse({ type: CategoryResponseDto })
  createCategory(@Body() input: CreateCategoryDto): Promise<CategoryResponseDto> {
    return this.categoriesService.create(input);
  }
}
