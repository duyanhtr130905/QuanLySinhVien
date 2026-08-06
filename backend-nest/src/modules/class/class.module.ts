import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../common/database/database.module';
import { HttpModule } from '../../common/http/http.module';
import { FilesModule } from '../../common/files/files.module';
import { ClassCommandService } from './application/class-command.service';
import { ClassQueryService } from './application/class-query.service';
import { ClassController } from './http/class.controller';
import { ClassAdvancedController } from './http/class-advanced.controller';
import { ClassMembershipService } from './application/class-membership.service';
import { ClassCopyService } from './application/class-copy.service';
import { ClassImportService } from './application/class-import.service';
import { ClassExportService } from './application/class-export.service';
import { ClassImportMulterFilter } from './http/class-import-multer.filter';
import { ClassRequestParser } from './http/class-request.parser';
import { ClassRepository } from './infrastructure/class.repository';
@Module({ imports: [DatabaseModule, HttpModule, FilesModule], controllers: [ClassAdvancedController, ClassController], providers: [ClassRepository, ClassRequestParser, ClassQueryService, ClassCommandService, ClassMembershipService, ClassCopyService, ClassImportService, ClassExportService, ClassImportMulterFilter] })
export class ClassModule {}
