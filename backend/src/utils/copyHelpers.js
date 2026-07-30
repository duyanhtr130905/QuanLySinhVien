/**
 * Sinh giá trị unique cho 1 cột bằng cách thêm hậu tố "-copy", "-copy-2"...
 * Dùng chung cho mọi bảng cần copy (tra_class chỉ dùng cho 'code', tra_student dùng cho code/username/email).
 * @param {import('pg').PoolClient} client
 * @param {string} tableName - 'tra_class' | 'tra_student'
 * @param {string} columnName
 * @param {string} originalValue
 * @param {number} maxLen
 */
const generateUniqueValue = async (client, tableName, columnName, originalValue, maxLen, reservedValues = new Set()) => {
  let suffix = '-copy';
  let counter = 1;
  let candidate;
  do {
    if (columnName === 'email') {
      const atIndex = originalValue.lastIndexOf('@');
      const localPart = originalValue.substring(0, atIndex);
      const domain = originalValue.substring(atIndex + 1);
      const newLocal = `${localPart}${suffix}`;
      candidate = (newLocal.length + 1 + domain.length > maxLen)
        ? `${localPart.substring(0, maxLen - 1 - domain.length - suffix.length)}${suffix}@${domain}`
        : `${newLocal}@${domain}`;
    } else {
      candidate = `${originalValue}${suffix}`;
      if (candidate.length > maxLen) {
        candidate = `${originalValue.substring(0, maxLen - suffix.length)}${suffix}`;
      }
    }
    const result = await client.query(`SELECT 1 FROM ${tableName} WHERE ${columnName} = $1`, [candidate]);
    if (result.rows.length === 0 && !reservedValues.has(candidate)) break;
    counter++;
    suffix = `-copy-${counter}`;
  } while (true);
  reservedValues.add(candidate);
  return candidate;
};

// The preview flow must not issue one existence query for every draft/field.
// Keep the exact suffix convention in a pure helper so callers can prepare a
// bounded batch of candidates and resolve them from one database result.
const buildCopyCandidate = (columnName, originalValue, maxLen, counter = 1) => {
  const suffix = counter === 1 ? '-copy' : `-copy-${counter}`;
  if (columnName === 'email') {
    const atIndex = String(originalValue).lastIndexOf('@');
    const localPart = String(originalValue).substring(0, atIndex);
    const domain = String(originalValue).substring(atIndex + 1);
    const copiedLocal = `${localPart}${suffix}`;
    return copiedLocal.length + 1 + domain.length > maxLen
      ? `${localPart.substring(0, maxLen - 1 - domain.length - suffix.length)}${suffix}@${domain}`
      : `${copiedLocal}@${domain}`;
  }

  const candidate = `${originalValue}${suffix}`;
  return candidate.length > maxLen
    ? `${String(originalValue).substring(0, maxLen - suffix.length)}${suffix}`
    : candidate;
};

const getCopyCandidateBatch = (columnName, originalValue, maxLen, attempts = 100) => (
  Array.from({ length: attempts }, (_, index) => buildCopyCandidate(columnName, originalValue, maxLen, index + 1))
);

/**
 * Chạy 1 transaction copy nhiều bản ghi — khung dùng chung cho massCopy của mọi module.
 * @param {import('pg').Pool} pool
 * @param {(client: import('pg').PoolClient, id: number) => Promise<object|null>} copyOneWithClientFn
 *        - Hàm copy 1 bản ghi trong transaction, riêng theo từng module (đã có sẵn ở class/student.service.js)
 * @param {number[]} idlist
 * @returns {Promise<{ created: object[], notFound: number[] }>}
 */
const runMassCopyTransaction = async (pool, copyOneWithClientFn, idlist) => {
  const client = await pool.connect();
  const created = [];
  const notFound = [];
  try {
    await client.query('BEGIN');
    for (const id of idlist) {
      const record = await copyOneWithClientFn(client, id);
      if (record === null) notFound.push(id); else created.push(record);
    }
    await client.query('COMMIT');
    return { created, notFound };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { generateUniqueValue, buildCopyCandidate, getCopyCandidateBatch, runMassCopyTransaction };
