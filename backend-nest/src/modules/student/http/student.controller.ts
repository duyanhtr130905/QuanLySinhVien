import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Query, UploadedFile, UploadedFiles, UseFilters, UseInterceptors } from '@nestjs/common';
import { AnyFilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { ApiResponseFactory } from '../../../common/http/api-response.factory';
import { LegacyFallback } from '../../../common/http/legacy-fallback.decorator';
import { StudentCommandService } from '../application/student-command.service';
import { StudentCopyService } from '../application/student-copy.service';
import { StudentQueryService } from '../application/student-query.service';
import { studentMessages } from '../errors/student.errors';
import { StudentRequestParser } from './student-request.parser';
import { StudentPageQueryDto } from './dto/student-page-query.dto';
import { StudentImageMulterFilter } from './student-image-multer.filter';

const image=FileInterceptor('attachment',{limits:{fileSize:5*1024*1024}});
const copyImages=AnyFilesInterceptor({limits:{fileSize:5*1024*1024}});

@Controller('student')
export class StudentController {
  constructor(private readonly queries:StudentQueryService,private readonly commands:StudentCommandService,private readonly copies:StudentCopyService,private readonly parser:StudentRequestParser,private readonly responses:ApiResponseFactory){}
  @Get('page') @LegacyFallback('C600') async page(@Query() query:StudentPageQueryDto){return this.responses.success(await this.queries.getPage(this.parser.parsePage(query)),studentMessages.page);}
  @Get('page/:init') @LegacyFallback('C600') async pageInit(@Query() query:StudentPageQueryDto,@Param('init') _init:string){return this.responses.success(await this.queries.getPage(this.parser.parsePage(query)),studentMessages.page);}
  @Get('deleted/page') @LegacyFallback('L600') async deletedPage(@Query() query:StudentPageQueryDto){return this.responses.success(await this.queries.getDeletedPage(this.parser.parsePage(query)),studentMessages.deletedPage);}
  @Patch('deleted/restore') @LegacyFallback('L600') async restore(@Body('idlist') ids:unknown){const result=await this.commands.restore(this.parser.parseTrashIds(ids));return this.responses.success(result,`\u0110\u00e3 kh\u00f4i ph\u1ee5c ${result.restored.length} sinh vi\u00ean`);}
  @Delete('deleted/permanent') @LegacyFallback('L600') async permanent(@Body('idlist') ids:unknown){const result=await this.commands.permanentlyDelete(this.parser.parseTrashIds(ids));return this.responses.success(result,`\u0110\u00e3 x\u00f3a v\u0129nh vi\u1ec5n ${result.deleted.length} sinh vi\u00ean`);}
  @Post('copy') @HttpCode(HttpStatus.OK) @LegacyFallback('H600') async copyMany(@Body('idlist') ids:unknown){const result=await this.copies.copyMany(this.parser.parseCopyIds(ids));const message=result.notFound.length?`\u0110\u00e3 sao ch\u00e9p ${result.created.length} sinh vi\u00ean. Kh\u00f4ng t\u00ecm th\u1ea5y ids: ${result.notFound.join(', ')}`:`Sao ch\u00e9p ${result.created.length} sinh vi\u00ean th\u00e0nh c\u00f4ng`;return this.responses.success(result.created,message);}
  @Post('copy/preview') @HttpCode(HttpStatus.OK) @LegacyFallback('H600') async copyPreview(@Body('idlist') ids:unknown){const result=await this.copies.preview(this.parser.parseCopyIds(ids) as unknown[]);return this.responses.success(result,`\u0110\u00e3 t\u1ea1o ${result.drafts.length} draft sinh vi\u00ean`);}
  @Post('copy/validate') @HttpCode(HttpStatus.OK) @LegacyFallback('H600') async copyValidate(@Body('drafts') drafts:unknown){return this.responses.success(await this.copies.validate(drafts),'ÄÃ£ kiá»ƒm tra cÃ¡c báº£n sao sinh viÃªn');}
  @Post('copy/commit') @HttpCode(HttpStatus.OK) @UseFilters(StudentImageMulterFilter) @UseInterceptors(copyImages) @LegacyFallback('H600') async copyCommit(@Body('drafts') drafts:unknown,@UploadedFiles() files:Express.Multer.File[]=[]){const parsed=typeof drafts==='string'?JSON.parse(drafts):drafts;const result=await this.copies.commit(parsed,files);return this.responses.success(result,`\u0110\u00e3 t\u1ea1o ${result.created.length} sinh vi\u00ean`);}
  @Post('copy/:id') @HttpCode(HttpStatus.OK) @LegacyFallback('H600') async copyOne(@Param('id') id:string){return this.responses.success(await this.copies.copyOne(this.parser.parseCopyId(id)),'Sao ch\u00e9p sinh vi\u00ean th\u00e0nh c\u00f4ng');}
  @Get() @LegacyFallback('B600') async all(@Query('columnlist') columnlist?:string){return this.responses.success(await this.queries.getAll(columnlist),studentMessages.list);}
  @Post() @HttpCode(HttpStatus.OK) @UseFilters(StudentImageMulterFilter) @UseInterceptors(image) @LegacyFallback('E600') async create(@Body() body:Record<string,unknown>,@UploadedFile() file?:Express.Multer.File){const input=this.parser.parseWrite(body,true,await this.commands.activeHobbyMask());return this.responses.success(await this.commands.create(input,file),studentMessages.create);}
  @Get(':id') @LegacyFallback('D600') async detail(@Param('id') id:string){return this.responses.success(await this.queries.getDetail(this.parser.parseId(id)),studentMessages.detail);}
  @Put(':id') @UseFilters(StudentImageMulterFilter) @UseInterceptors(image) @LegacyFallback('F600') async update(@Param('id') id:string,@Body() body:Record<string,unknown>,@UploadedFile() file?:Express.Multer.File){const input=this.parser.parseWrite(body,false,await this.commands.activeHobbyMask());return this.responses.success(await this.commands.update(this.parser.parseUpdateId(id),input,file),studentMessages.update);}
  @Delete() @LegacyFallback('G600') async destroyMany(@Body('idlist') ids:unknown){const result=await this.commands.destroyMany(this.parser.parseDestroyIds(ids));const message=result.notFound.length?`\u0110\u00e3 x\u00f3a ${result.deleted.length} sinh vi\u00ean. Kh\u00f4ng t\u00ecm th\u1ea5y ids: ${result.notFound.join(', ')}`:`X\u00f3a ${result.deleted.length} sinh vi\u00ean th\u00e0nh c\u00f4ng`;return this.responses.success(result,message);}
  @Delete(':id') @LegacyFallback('G600') async destroy(@Param('id') id:string){return this.responses.success(await this.commands.destroy(this.parser.parseDestroyId(id)),studentMessages.delete);}
}
