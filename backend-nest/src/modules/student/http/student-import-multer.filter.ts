import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { MulterError } from 'multer';
import type { Response } from 'express';
import { ApiResponseFactory } from '../../../common/http/api-response.factory';
@Catch(MulterError)
export class StudentImportMulterFilter implements ExceptionFilter { constructor(private readonly responses:ApiResponseFactory){} catch(error:MulterError,host:ArgumentsHost){const message=error.code==='LIMIT_FILE_SIZE'?'File không được vượt quá 10MB':'File import không hợp lệ';host.switchToHttp().getResponse<Response>().status(400).json(this.responses.error(400,'J604',message));} }
