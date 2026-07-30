import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../common/database/database.module';
import { HttpModule } from '../../common/http/http.module';
import { ClassCommandService } from './application/class-command.service';
import { ClassQueryService } from './application/class-query.service';
import { ClassController } from './http/class.controller';
import { ClassRequestParser } from './http/class-request.parser';
import { ClassRepository } from './infrastructure/class.repository';
@Module({ imports: [DatabaseModule, HttpModule], controllers: [ClassController], providers: [ClassRepository, ClassRequestParser, ClassQueryService, ClassCommandService] })
export class ClassModule {}
