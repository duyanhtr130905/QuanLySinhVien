import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { MulterError } from 'multer';
import { ApiResponseFactory } from '../../../common/http/api-response.factory';

@Catch(MulterError)
export class ClassImportMulterFilter implements ExceptionFilter {
  constructor(private readonly responses: ApiResponseFactory) {}
  catch(exception: MulterError, host: ArgumentsHost): void { const response = host.switchToHttp().getResponse<Response>(); if (exception.code === 'LIMIT_FILE_SIZE') { response.status(400).json(this.responses.error(400, 'J604', 'File không được vượt quá 10MB')); return; } response.status(400).json(this.responses.error(400, 'J604', exception.message)); }
}
