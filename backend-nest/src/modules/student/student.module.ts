import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../common/database/database.module';
import { FilesModule } from '../../common/files/files.module';
import { HttpModule } from '../../common/http/http.module';
import { SecurityModule } from '../../common/security/security.module';
import { StorageModule } from '../../common/storage/storage.module';
import { StudentCommandService } from './application/student-command.service';
import { StudentCopyService } from './application/student-copy.service';
import { StudentImportExportService } from './application/student-import-export.service';
import { StudentQueryService } from './application/student-query.service';
import { StudentController } from './http/student.controller';
import { StudentImageMulterFilter } from './http/student-image-multer.filter';
import { StudentImportMulterFilter } from './http/student-import-multer.filter';
import { StudentRequestParser } from './http/student-request.parser';
import { STUDENT_REPOSITORY, STUDENT_TRANSACTION } from './domain/student-persistence.port';
import { StudentPgTransactionAdapter } from './infrastructure/student-pg-transaction.adapter';
import { StudentRepository } from './infrastructure/student.repository';

@Module({
  imports: [DatabaseModule, FilesModule, HttpModule, SecurityModule, StorageModule],
  controllers: [StudentController],
  providers: [StudentRepository, StudentPgTransactionAdapter, { provide: STUDENT_REPOSITORY, useExisting: StudentRepository }, { provide: STUDENT_TRANSACTION, useExisting: StudentPgTransactionAdapter }, StudentRequestParser, StudentQueryService, StudentCommandService, StudentCopyService, StudentImportExportService, StudentImageMulterFilter, StudentImportMulterFilter],
})
export class StudentModule {}
