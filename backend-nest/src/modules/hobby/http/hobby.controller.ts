import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiResponseFactory, type LegacyApiResponse } from '../../../common/http/api-response.factory';
import { LegacyFallback } from '../../../common/http/legacy-fallback.decorator';
import type { Hobby } from '../domain/hobby.entity';
import { hobbyException, hobbyMessages } from '../errors/hobby.errors';
import { HobbyService } from '../application/hobby.service';
import { CreateHobbyDto } from './dto/create-hobby.dto';

@Controller('hobby')
export class HobbyController {
  constructor(
    private readonly hobbies: HobbyService,
    private readonly responses: ApiResponseFactory,
  ) {}

  @Get()
  @LegacyFallback('B600')
  async getAll(): Promise<LegacyApiResponse<Hobby[]>> {
    return this.responses.success(await this.hobbies.getAll(), hobbyMessages.list);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @LegacyFallback('E600')
  async create(@Body() input: CreateHobbyDto): Promise<LegacyApiResponse<Hobby>> {
    return this.responses.success(await this.hobbies.create(input), hobbyMessages.create);
  }

  @Delete(':id')
  @LegacyFallback('G600')
  async delete(@Param('id') rawId: string): Promise<LegacyApiResponse<{ id: string }>> {
    return this.responses.success(await this.hobbies.delete(this.parseLegacyId(rawId)), hobbyMessages.delete);
  }

  private parseLegacyId(value: string): number {
    const id = Number.parseInt(value, 10);
    if (!Number.isInteger(id) || id <= 0) throw hobbyException.invalidId();
    return id;
  }
}
