export const IMPORT_FORMATS = ['csv', 'xlsx', 'json', 'xml']
export const MAX_IMPORT_FILE_SIZE = 10 * 1024 * 1024

export const getFileExtension = name => {
  const matched = String(name || '').toLowerCase().match(/\.([^.]+)$/)
  return matched ? matched[1] : ''
}

export const validateImportFile = file => {
  if (!file) return 'Vui lòng chọn file dữ liệu.'
  const extension = getFileExtension(file.name)
  if (!IMPORT_FORMATS.includes(extension)) {
    return 'Chỉ chấp nhận file CSV, XLSX, JSON hoặc XML.'
  }
  if (file.size > MAX_IMPORT_FILE_SIZE) {
    return 'Dung lượng file không được vượt quá 10MB.'
  }
  return ''
}

export const formatFileSize = size => {
  const value = Number(size) || 0
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

const TEMPLATE_COLUMNS = [
  'code', 'fullname', 'dob', 'sex', 'class_id', 'email', 'username', 'password',
  'homecity', 'address', 'hobbies', 'description', 'hair_color', 'facebook'
]

const TEMPLATE_ROW = {
  code: 'SV001',
  fullname: 'Nguyễn Văn An',
  dob: '2004-01-15',
  sex: true,
  class_id: '',
  email: 'sv001@example.com',
  username: 'sv001',
  password: 'Aa1!abcd',
  homecity: 'Hà Nội',
  address: '',
  hobbies: 0,
  description: '',
  hair_color: '#000000',
  facebook: '',
}

const escapeXml = value => String(value === undefined || value === null ? '' : value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;')

const escapeCsv = value => {
  const text = String(value === undefined || value === null ? '' : value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const textEncoder = new TextEncoder()
const utf8 = value => textEncoder.encode(value)

const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? (0xEDB88320 ^ (value >>> 1)) : (value >>> 1)
    }
    table[index] = value >>> 0
  }
  return table
})()

const crc32 = bytes => {
  let value = 0xFFFFFFFF
  bytes.forEach(byte => { value = crcTable[(value ^ byte) & 0xFF] ^ (value >>> 8) })
  return (value ^ 0xFFFFFFFF) >>> 0
}

const writeUint16 = (view, offset, value) => view.setUint16(offset, value, true)
const writeUint32 = (view, offset, value) => view.setUint32(offset, value, true)

const concatBytes = parts => {
  const size = parts.reduce((total, part) => total + part.length, 0)
  const result = new Uint8Array(size)
  let offset = 0
  parts.forEach(part => {
    result.set(part, offset)
    offset += part.length
  })
  return result
}

// XLSX is a ZIP archive. This small writer creates a standards-compliant, uncompressed workbook
// so templates remain valid without adding a spreadsheet package to the frontend.
const createStoredZip = files => {
  let localOffset = 0
  const localParts = []
  const centralParts = []

  files.forEach(({ name, content }) => {
    const nameBytes = utf8(name)
    const data = utf8(content)
    const checksum = crc32(data)
    const localHeader = new Uint8Array(30)
    const localView = new DataView(localHeader.buffer)
    writeUint32(localView, 0, 0x04034B50)
    writeUint16(localView, 4, 20)
    writeUint16(localView, 8, 0)
    writeUint32(localView, 14, checksum)
    writeUint32(localView, 18, data.length)
    writeUint32(localView, 22, data.length)
    writeUint16(localView, 26, nameBytes.length)
    const localPart = concatBytes([localHeader, nameBytes, data])
    localParts.push(localPart)

    const centralHeader = new Uint8Array(46)
    const centralView = new DataView(centralHeader.buffer)
    writeUint32(centralView, 0, 0x02014B50)
    writeUint16(centralView, 4, 20)
    writeUint16(centralView, 6, 20)
    writeUint16(centralView, 10, 0)
    writeUint32(centralView, 16, checksum)
    writeUint32(centralView, 20, data.length)
    writeUint32(centralView, 24, data.length)
    writeUint16(centralView, 28, nameBytes.length)
    writeUint32(centralView, 42, localOffset)
    centralParts.push(concatBytes([centralHeader, nameBytes]))
    localOffset += localPart.length
  })

  const centralDirectory = concatBytes(centralParts)
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  writeUint32(endView, 0, 0x06054B50)
  writeUint16(endView, 8, files.length)
  writeUint16(endView, 10, files.length)
  writeUint32(endView, 12, centralDirectory.length)
  writeUint32(endView, 16, localOffset)
  return concatBytes([...localParts, centralDirectory, end])
}

const getColumnName = index => {
  let number = index + 1
  let name = ''
  while (number > 0) {
    const remainder = (number - 1) % 26
    name = String.fromCharCode(65 + remainder) + name
    number = Math.floor((number - 1) / 26)
  }
  return name
}

const buildXlsx = () => {
  const rows = [TEMPLATE_COLUMNS, TEMPLATE_COLUMNS.map(key => TEMPLATE_ROW[key])]
  const worksheetRows = rows.map((row, rowIndex) => (
    `<row r="${rowIndex + 1}">${row.map((value, columnIndex) => (
      `<c r="${getColumnName(columnIndex)}${rowIndex + 1}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`
    )).join('')}</row>`
  )).join('')
  const worksheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${worksheetRows}</sheetData></worksheet>`

  return createStoredZip([
    {
      name: '[Content_Types].xml',
      content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'
    },
    {
      name: '_rels/.rels',
      content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
    },
    {
      name: 'xl/workbook.xml',
      content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Students" sheetId="1" r:id="rId1"/></sheets></workbook>'
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'
    },
    { name: 'xl/worksheets/sheet1.xml', content: worksheet },
  ])
}

export const createImportTemplate = format => {
  if (!IMPORT_FORMATS.includes(format)) throw new Error('Định dạng mẫu không hợp lệ.')
  if (format === 'csv') {
    const content = `${TEMPLATE_COLUMNS.join(',')}\r\n${TEMPLATE_COLUMNS.map(key => escapeCsv(TEMPLATE_ROW[key])).join(',')}\r\n`
    return new Blob([content], { type: 'text/csv;charset=utf-8' })
  }
  if (format === 'json') {
    return new Blob([JSON.stringify([TEMPLATE_ROW], null, 2)], { type: 'application/json' })
  }
  if (format === 'xml') {
    const fields = TEMPLATE_COLUMNS.map(key => `<${key}>${escapeXml(TEMPLATE_ROW[key])}</${key}>`).join('')
    return new Blob([`<?xml version="1.0" encoding="UTF-8"?><records><record>${fields}</record></records>`], { type: 'application/xml' })
  }
  return new Blob([buildXlsx()], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })
}
