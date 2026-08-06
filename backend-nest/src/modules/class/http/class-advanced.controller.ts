import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Res, UploadedFile, UseFilters, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { ApiResponseFactory } from '../../../common/http/api-response.factory';
import { LegacyApiException } from '../../../common/http/legacy-api.exception';
import { LegacyFallback } from '../../../common/http/legacy-fallback.decorator';
import { ClassCopyService } from '../application/class-copy.service';
import { ClassExportService } from '../application/class-export.service';
import { ClassImportService } from '../application/class-import.service';
import { ClassMembershipService } from '../application/class-membership.service';
import { classMessages } from '../errors/class.errors';
import { ClassRequestParser } from './class-request.parser';
import { ClassPageQueryDto } from './dto/class-page-query.dto';
import { ClassImportMulterFilter } from './class-import-multer.filter';

@Controller('class')
export class ClassAdvancedController {
  constructor(private readonly membership: ClassMembershipService, private readonly copy: ClassCopyService, private readonly imports: ClassImportService, private readonly exports: ClassExportService, private readonly parser: ClassRequestParser, private readonly responses: ApiResponseFactory) {}
  @Get(':id/students') @LegacyFallback('L600') async students(@Param('id') id: string, @Query() query: ClassPageQueryDto) { return this.responses.success(await this.membership.getStudents(this.parser.parseMembershipId(id), this.parser.parseMembershipPage(query)), classMessages.students); }
  @Get(':id/available-students') @LegacyFallback('L600') async availableStudents(@Param('id') id: string, @Query() query: ClassPageQueryDto) { return this.responses.success(await this.membership.getAvailableStudents(this.parser.parseMembershipId(id), this.parser.parseMembershipPage(query)), classMessages.availableStudents); }
  @Post(':id/students') @HttpCode(HttpStatus.OK) @LegacyFallback('L600') async assign(@Param('id') id: string, @Body('studentIds') studentIds: unknown) { return this.responses.success({ studentIds: await this.membership.assign(this.parser.parseMembershipId(id), this.parser.parseStudentIds(studentIds)) }, classMessages.assignStudents); }
  @Patch(':id/students/remove') @LegacyFallback('L600') async removeMany(@Param('id') id: string, @Body('studentIds') studentIds: unknown) { return this.responses.success({ studentIds: await this.membership.removeMany(this.parser.parseMembershipId(id), this.parser.parseStudentIds(studentIds)) }, classMessages.removeStudents); }
  @Delete(':id/students/:studentId') @LegacyFallback('L600') async removeOne(@Param('id') id: string, @Param('studentId') studentId: string) { return this.responses.success(await this.membership.removeOne(this.parser.parseMembershipId(id), this.parser.parseMembershipId(studentId)), classMessages.removeStudents); }
  @Post('copy') @HttpCode(HttpStatus.OK) @LegacyFallback('H600') async copyMany(@Body('idlist') idlist: unknown) { const data = await this.copy.copyMany(this.parser.parseCopyIds(idlist)); const message = data.notFound.length ? `\u0110\u00e3 sao ch\u00e9p ${data.created.length} l\u1edbp. Kh\u00f4ng t\u00ecm th\u1ea5y ids: ${data.notFound.join(', ')}` : `Sao ch\u00e9p ${data.created.length} l\u1edbp th\u00e0nh c\u00f4ng`; return this.responses.success(data.created, message); }
  @Post('copy/preview') @HttpCode(HttpStatus.OK) @LegacyFallback('H600') async preview(@Body('idlist') idlist: unknown) { const data = await this.copy.preview(this.parser.parseCopyIds(idlist)); return this.responses.success(data, `\u0110\u00e3 t\u1ea1o ${data.drafts.length} draft l\u1edbp`); }
  @Post('copy/validate') @HttpCode(HttpStatus.OK) @LegacyFallback('H600') async validate(@Body('drafts') drafts: unknown) { return this.responses.success(await this.copy.validate(drafts), classMessages.copyValidate); }
  @Post('copy/commit') @HttpCode(HttpStatus.OK) @LegacyFallback('H600') async commit(@Body('drafts') drafts: unknown) { const data = await this.copy.commit(this.parser.parseCopyDrafts(drafts)); return this.responses.success(data, `\u0110\u00e3 t\u1ea1o ${data.created.length} l\u1edbp`); }
  @Post('copy/:id') @HttpCode(HttpStatus.OK) @LegacyFallback('H600') async copyOne(@Param('id') id: string) { return this.responses.success(await this.copy.copyOne(this.parser.parseCopyId(id)), classMessages.copyOne); }
  @Post('import') @HttpCode(HttpStatus.OK) @LegacyFallback('J600') @UseFilters(ClassImportMulterFilter) @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })) async import(@UploadedFile() file?: Express.Multer.File) { if (!file) throw new LegacyApiException({ status: 400, code: 'J604', message: 'Kh\u00f4ng t\u00ecm th\u1ea5y file upload' }); const data = await this.imports.import(file.buffer, file.originalname); return this.responses.success(data, classMessages.import(data.created.length, data.failed.length)); }
  @Get('export/:id') @LegacyFallback('K600') async exportOne(@Param('id') id: string, @Query('type') type: unknown, @Res() response: Response) { const file = await this.exports.one(this.parser.parseExportId(id), type); response.setHeader('Content-Type', file.contentType); response.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`); response.send(file.buffer); }
  @Post('export') @HttpCode(HttpStatus.OK) @LegacyFallback('K600') async exportMany(@Body('idlist') idlist: unknown, @Body('type') type: unknown, @Res() response: Response) { const file = await this.exports.many(this.parser.parseExportIds(idlist), type); response.setHeader('Content-Type', file.contentType); response.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`); response.send(file.buffer); }
}
