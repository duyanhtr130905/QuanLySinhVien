const XLSX = require('xlsx');
const { parse: csvParse } = require('csv-parse/sync');
const { stringify: csvStringify } = require('csv-stringify/sync');
const xml2js = require('xml2js');

const SUPPORTED_FORMATS = ['csv', 'xlsx', 'json', 'xml'];

/**
 * Parse buffer file thành mảng object (rows), tự nhận diện theo extension.
 * @param {Buffer} buffer
 * @param {string} extension - 'csv'|'xlsx'|'json'|'xml' (lowercase, không có dấu chấm)
 * @returns {Promise<object[]>}
 */
const parseFile = async (buffer, extension) => {
  const ext = extension.toLowerCase();
  if (!SUPPORTED_FORMATS.includes(ext)) {
    throw new Error('UNSUPPORTED_FORMAT');
  }

  switch (ext) {
    case 'csv': {
      return csvParse(buffer, { columns: true, skip_empty_lines: true, trim: true });
    }
    case 'xlsx': {
      const workbook = XLSX.read(buffer);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      return XLSX.utils.sheet_to_json(sheet);
    }
    case 'json': {
      const data = JSON.parse(buffer.toString('utf-8'));
      if (Array.isArray(data)) return data;
      if (data.records && Array.isArray(data.records)) return data.records;
      throw new Error('JSON phải là mảng hoặc { records: [...] }');
    }
    case 'xml': {
      const parsed = await xml2js.parseStringPromise(buffer.toString('utf-8'), {
        explicitArray: false,
      });
      if (!parsed.records || !parsed.records.record) {
        throw new Error('XML phải có cấu trúc <records><record>...</record></records>');
      }
      const records = parsed.records.record;
      return Array.isArray(records) ? records : [records];
    }
    default:
      throw new Error('UNSUPPORTED_FORMAT');
  }
};

/**
 * Build buffer file từ mảng rows theo format yêu cầu.
 * @param {object[]} rows
 * @param {string} format - 'csv'|'xlsx'|'json'|'xml'
 * @returns {{ buffer: Buffer, contentType: string, extension: string }}
 */
const buildFile = (rows, format, columns) => {
  const fmt = format.toLowerCase();
  if (!SUPPORTED_FORMATS.includes(fmt)) {
    throw new Error('UNSUPPORTED_FORMAT');
  }

  switch (fmt) {
    case 'csv': {
      const csv = csvStringify(rows, { header: true, columns });
      return { buffer: Buffer.from(csv), contentType: 'text/csv', extension: 'csv' };
    }
    case 'xlsx': {
      const sheet = XLSX.utils.json_to_sheet(rows, { header: columns });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheet, 'Students');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      return {
        buffer: buf,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        extension: 'xlsx',
      };
    }
    case 'json': {
      return {
        buffer: Buffer.from(JSON.stringify(rows, null, 2)),
        contentType: 'application/json',
        extension: 'json',
      };
    }
    case 'xml': {
      const builder = new xml2js.Builder();
      const xml = builder.buildObject({ records: { record: rows } });
      return { buffer: Buffer.from(xml), contentType: 'application/xml', extension: 'xml' };
    }
    default:
      throw new Error('UNSUPPORTED_FORMAT');
  }
};

module.exports = { parseFile, buildFile };
