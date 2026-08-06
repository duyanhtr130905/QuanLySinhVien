import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { MulterError } from 'multer';
import { ApiResponseFactory } from '../../../common/http/api-response.factory';

@Catch(MulterError)
export class StudentImageMulterFilter implements ExceptionFilter {
  constructor(private readonly responses:ApiResponseFactory){}
  catch(_error:MulterError,host:ArgumentsHost):void{host.switchToHttp().getResponse<Response>().status(400).json(this.responses.error(400,'E603','\u1ea2nh ph\u1ea3i l\u00e0 jpg/jpeg/png, t\u1ed1i \u0111a 5MB'));}
}
