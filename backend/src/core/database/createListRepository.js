const { resolveColumns, resolveOrderBy } = require('../../utils/queryHelpers');

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

const assertConfiguredIdentifier = (value, label) => {
  if (!IDENTIFIER.test(value)) throw new TypeError(`${label} không hợp lệ`);
  return value;
};

const normalizeToplist = (toplist) => (toplist || [])
  .map((id) => parseInt(id, 10))
  .filter(Boolean);

/**
 * Create a read-only repository for an allowlisted table and column set.
 * All values derived from a request are supplied through query parameters;
 * identifiers and ordering are produced only from the module configuration.
 */
const createListRepository = ({
  pool,
  tableName,
  validColumns,
  defaultColumns,
  columnAliases,
  searchColumns,
  baseWhereClause = '',
  deletedFilter = '',
  defaultOrder = 'ORDER BY id ASC',
  additionalSelect = '',
  rowMapper = (row) => row,
}) => {
  if (!pool || typeof pool.query !== 'function') throw new TypeError('pool.query là bắt buộc');
  assertConfiguredIdentifier(tableName, 'tableName');
  for (const column of validColumns) assertConfiguredIdentifier(column, 'validColumns');
  for (const column of defaultColumns) assertConfiguredIdentifier(column, 'defaultColumns');
  for (const column of searchColumns) assertConfiguredIdentifier(column, 'searchColumns');
  if (typeof rowMapper !== 'function') throw new TypeError('rowMapper phải là function');

  const defaultSelect = defaultColumns.join(', ');
  const getColumns = (columnlist) => resolveColumns(validColumns, defaultSelect, columnlist);
  const baseConditions = [baseWhereClause, deletedFilter].filter(Boolean);

  const getAll = async (columnlist) => {
    const columns = getColumns(columnlist);
    const whereClause = baseConditions.length ? `WHERE ${baseConditions.join(' AND ')}` : '';
    const result = await pool.query(`SELECT ${columns}${additionalSelect} FROM ${tableName} ${whereClause} ${defaultOrder}`);
    return result.rows.map(rowMapper);
  };

  const getByPage = async ({ page, size, order, search, columnlist, toplist, excludeIds }) => {
    const columns = getColumns(columnlist);
    const queryParams = [];
    const conditions = [...baseConditions];

    if (search) {
      const parameter = `$${queryParams.length + 1}`;
      queryParams.push(`%${search}%`);
      conditions.push(`(${searchColumns.map((column) => `${column} ILIKE ${parameter}`).join(' OR ')})`);
    }

    const excludedIds = normalizeToplist(excludeIds);
    if (excludedIds.length) {
      const placeholders = excludedIds.map((_, index) => `$${queryParams.length + index + 1}`).join(', ');
      queryParams.push(...excludedIds);
      conditions.push(`id NOT IN (${placeholders})`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    // Count and page data are independent reads. Start the count before SQL
    // construction below so a paged list does not pay two network round trips.
    // pg may consume values asynchronously. Preserve the count query's
    // parameter snapshot before the page query appends toplist/limit/offset.
    const countPromise = pool.query(`SELECT COUNT(*) FROM ${tableName} ${whereClause}`, [...queryParams]);

    const orderBy = resolveOrderBy(columnAliases, order) || defaultOrder;
    const pinnedIds = normalizeToplist(toplist);
    let toplistClause = '';
    if (pinnedIds.length) {
      const placeholders = pinnedIds.map((_, index) => `$${queryParams.length + index + 1}`).join(', ');
      queryParams.push(...pinnedIds);
      toplistClause = `CASE WHEN id IN (${placeholders}) THEN 0 ELSE 1 END,`;
    }

    const offset = (page - 1) * size;
    const sizeParameter = `$${queryParams.length + 1}`;
    queryParams.push(size);
    const offsetParameter = `$${queryParams.length + 1}`;
    queryParams.push(offset);

    const dataSql = `
      SELECT ${columns}${additionalSelect}
      FROM ${tableName}
      ${whereClause}
      ORDER BY ${toplistClause} ${orderBy.replace('ORDER BY ', '')}
      LIMIT ${sizeParameter} OFFSET ${offsetParameter}
    `;
    const [countResult, dataResult] = await Promise.all([countPromise, pool.query(dataSql, queryParams)]);
    const totalItems = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalItems / size);

    return {
      page_info: {
        total_items: totalItems,
        total_pages: totalPages,
        current: page,
        size,
      },
      records: dataResult.rows.map(rowMapper),
    };
  };

  return { getAll, getByPage };
};

module.exports = createListRepository;
