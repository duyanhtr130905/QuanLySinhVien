import { ArgumentsHost, Catch, ExceptionFilter, PayloadTooLargeException } from '@nestjs/common';
import type { Response } from 'express';
import { MulterError } from 'multer';
import { ApiResponseFactory } from '../../../common/http/api-response.factory';

// FileInterceptor converts Multer's LIMIT_FILE_SIZE error to PayloadTooLargeException.
@Catch(MulterError, PayloadTooLargeException)
export class ClassImportMulterFilter implements ExceptionFilter {
  constructor(private readonly responses: ApiResponseFactory) {}
  catch(exception: MulterError | PayloadTooLargeException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    if (exception instanceof PayloadTooLargeException || exception.code === 'LIMIT_FILE_SIZE') {
      response.status(400).json(this.responses.error(400, 'J604', 'File không được vượt quá 10MB'));
      return;
    }
    response.status(400).json(this.responses.error(400, 'J604', exception.message));
  }
}
