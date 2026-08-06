import { Injectable } from '@nestjs/common';
import { FileCodecRegistry } from '../../../common/files/file-codec.registry';
import type { FileFormat } from '../../../common/files/file-format.type';
import { classException } from '../errors/class.errors';
import { ClassCommandService } from './class-command.service';
import type { CreateClassInput } from '../http/class-request.parser';

@Injectable()
export class ClassImportService {
  constructor(private readonly codecs: FileCodecRegistry, private readonly commands: ClassCommandService) {}
  async import(buffer: Buffer, filename: string) { const format = filename.split('.').pop()?.toLowerCase() as FileFormat; let rows: Record<string, unknown>[]; try { rows = await this.codecs.get(format).parse(buffer); } catch (error) { if (error instanceof Error && error.message.startsWith('unsupported file format')) throw classException.invalidImportFormat(); throw classException.invalidImportFile(`Không đọc được dữ liệu từ file: ${error instanceof Error ? error.message : String(error)}`); } if (!Array.isArray(rows) || !rows.length) throw classException.invalidImportFile('File không có dữ liệu'); const created: unknown[] = []; const failed: Array<{ row: number; reason: string }> = []; for (const [index, row] of rows.entries()) { try { created.push(await this.commands.create(this.row(row))); } catch (error) { failed.push({ row: index + 2, reason: error instanceof Error ? error.message : 'Lỗi không xác định' }); } } return { created, failed }; }
  private row(row: Record<string, unknown>): CreateClassInput { const code = typeof row.code === 'string' ? row.code.trim() : ''; const name = typeof row.name === 'string' ? row.name.trim() : ''; if (!code || !name) throw new Error('code và name là bắt buộc'); if (code.length > 50) throw new Error('code không được vượt quá 50 ký tự'); if (name.length > 255) throw new Error('name không được vượt quá 255 ký tự'); return { code, name, description: row.description }; }
}
