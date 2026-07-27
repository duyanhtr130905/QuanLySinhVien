/**
 * Lọc danh sách cột hợp lệ từ chuỗi columnlist do client gửi.
 * @param {string[]} validColumns - Danh sách cột được phép SELECT của bảng này
 * @param {string} defaultSelect - Chuỗi cột mặc định (đã join sẵn) nếu không lọc được cột nào
 * @param {string|undefined} columnlist
 * @returns {string}
 */
const resolveColumns = (validColumns, defaultSelect, columnlist) => {
  if (!columnlist) return defaultSelect;
  const cols = columnlist.split(',').map((c) => c.trim()).filter((c) => validColumns.includes(c));
  return cols.length ? cols.join(', ') : defaultSelect;
};

/**
 * Parse chuỗi order "alias:1-alias2:0" thành mệnh đề ORDER BY SQL.
 * @param {object} columnAlias - Map alias ngắn -> tên cột thật, riêng cho từng bảng
 * @param {string|undefined} orderStr
 * @returns {string}
 */
const resolveOrderBy = (columnAlias, orderStr) => {
  if (!orderStr) return '';
  const parts = orderStr.split('-').map((part) => {
    const [alias, dir] = part.split(':');
    const col = columnAlias[alias];
    if (!col) return null;
    return `${col} ${dir === '1' ? 'DESC' : 'ASC'}`;
  });
  const valid = parts.filter(Boolean);
  return valid.length ? `ORDER BY ${valid.join(', ')}` : '';
};

/** Xây mệnh đề CASE WHEN để ghim các id trong toplist lên đầu ORDER BY. */
module.exports = { resolveColumns, resolveOrderBy };
