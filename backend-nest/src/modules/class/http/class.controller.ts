import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query } from '@nestjs/common';
import { ApiResponseFactory, type LegacyApiResponse } from '../../../common/http/api-response.factory';
import { LegacyFallback } from '../../../common/http/legacy-fallback.decorator';
import { ClassCommandService } from '../application/class-command.service';
import { ClassQueryService } from '../application/class-query.service';
import type { StudentClass } from '../domain/student-class.entity';
import { classMessages } from '../errors/class.errors';
import { ClassRequestParser } from './class-request.parser';
import { CreateClassDto } from './dto/create-class.dto';
import { ClassPageQueryDto } from './dto/class-page-query.dto';
import { UpdateClassDto } from './dto/update-class.dto';

@Controller('class')
export class ClassController {
  constructor(private readonly queryService: ClassQueryService, private readonly commandService: ClassCommandService, private readonly parser: ClassRequestParser, private readonly responses: ApiResponseFactory) {}
  @Get('page') @LegacyFallback('C600') async getPage(@Query() query: ClassPageQueryDto) { return this.responses.success(await this.queryService.getPage(this.parser.parsePage(query)), classMessages.page); }
  @Get('page/:init') @LegacyFallback('C600') async getPageWithInit(@Query() query: ClassPageQueryDto, @Param('init') _init: string) { return this.responses.success(await this.queryService.getPage(this.parser.parsePage(query)), classMessages.page); }
  @Delete('delete') @LegacyFallback('I600') async deleteMany(@Body('ids') ids: unknown) { const result = await this.commandService.deleteMany(this.parser.parseMassDelete(ids)); const message = result.blockedIds.length ? `Đã xóa ${result.deletedIds.length} lớp. Không thể xóa ${result.blockedIds.length} lớp vì còn sinh viên liên kết (ids: ${result.blockedIds.join(', ')})` : classMessages.massDelete; return this.responses.success(result, message); }
  @Get() @LegacyFallback('B600') async getAll(@Query('columnlist') columnlist?: string): Promise<LegacyApiResponse<StudentClass[]>> { return this.responses.success(await this.queryService.getAll(columnlist), classMessages.list); }
  @Post() @HttpCode(HttpStatus.OK) @LegacyFallback('E600') async create(@Body() body: CreateClassDto) { return this.responses.success(await this.commandService.create(this.parser.parseCreate(body)), classMessages.create); }
  @Get(':id') @LegacyFallback('D600') async getDetail(@Param('id') id: string) { return this.responses.success(await this.queryService.getDetail(this.parser.parseId(id, 'detail')), classMessages.detail); }
  @Put(':id') @LegacyFallback('F600') async update(@Param('id') id: string, @Body() body: UpdateClassDto) { return this.responses.success(await this.commandService.update(this.parser.parseId(id, 'update'), this.parser.parseUpdate(body)), classMessages.update); }
  @Delete(':id') @LegacyFallback('G600') async delete(@Param('id') id: string) { return this.responses.success(await this.commandService.delete(this.parser.parseId(id, 'delete')), classMessages.delete); }
}
