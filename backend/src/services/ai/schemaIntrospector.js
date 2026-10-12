/**
 * TỰ SINH MÔ TẢ CƠ SỞ DỮ LIỆU CHO AI SINH SQL (thay cho danh sách bảng viết tay)
 *
 * Trước đây mô tả DB gửi cho Gemini được viết tay và đã lệch với DB thật (cột không tồn
 * tại như orders.channel, purchase_orders.expected_date; giá trị trạng thái sai như
 * payment_method 'VIETQR'/'MOMO'; chỉ mô tả 16/55 bảng) → Gemini viết SQL dùng cột/giá
 * trị không có thật. Module này đọc trực tiếp từ PostgreSQL:
 *   - bảng, cột, kiểu dữ liệu, khoá chính, khoá ngoại (information_schema)
 *   - giá trị thật của các cột dạng trạng thái/loại (status, type, method, role...)
 * và chỉ liệt kê bảng/cột mà vai trò được phép đọc (khớp safeSqlExecutor), nên mô tả
 * không bao giờ lệch với DB và không "gợi ý" cho AI những cột bị chặn.
 *
 * Kết quả đọc DB được lưu đệm SCHEMA_TTL_MS; chỉ đọc catalog + GROUP BY trên vài cột trạng thái.
 */
const prisma = require('../../config/database');
const { accessGroupOf, isTableReadable, isColumnReadable } = require('./safeSqlExecutor');

const SCHEMA_TTL_MS = 30 * 60 * 1000;
const MAX_ENUM_VALUES = 20;
// Cột "dạng trạng thái/loại": liệt kê giá trị thật để AI dùng đúng giá trị
const ENUM_COLUMN = /^(status|type|method|role|tier|priority|channel|purpose|department|level)$|_(status|type|method|role|tier|priority|level)$/;
// Bảng nội bộ của hệ thống, không có giá trị cho câu hỏi nghiệp vụ
const SKIP_TABLES = new Set(['ai_audit_logs', 'ai_feedback', 'role_permissions', 'knowledge_documents', 'location_history']);

const TYPE_ALIAS = {
  'character varying': 'text', character: 'text', text: 'text', uuid: 'uuid',
  integer: 'int', bigint: 'int', smallint: 'int',
  numeric: 'number', 'double precision': 'number', real: 'number',
  boolean: 'bool', date: 'date', 'timestamp with time zone': 'timestamp', 'timestamp without time zone': 'timestamp',
  jsonb: 'json', json: 'json', ARRAY: 'array', 'USER-DEFINED': 'enum'
};

let cache = null;
let cacheAt = 0;
let loading = null;

const loadSchema = async () => {
  const [columns, keys] = await Promise.all([
    prisma.$queryRaw`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position`,
    prisma.$queryRaw`
      SELECT tc.constraint_type, tc.table_name, kcu.column_name,
             ccu.table_name AS ref_table, ccu.column_name AS ref_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
      LEFT JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
      WHERE tc.table_schema = 'public' AND tc.constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY')`
  ]);

  const tables = {};
  for (const c of columns) {
    if (SKIP_TABLES.has(c.table_name) || c.table_name.startsWith('_')) continue;
    (tables[c.table_name] = tables[c.table_name] || {})[c.column_name] = { type: TYPE_ALIAS[c.data_type] || c.data_type };
  }
  for (const k of keys) {
    const col = tables[k.table_name]?.[k.column_name];
    if (!col) continue;
    if (k.constraint_type === 'PRIMARY KEY') col.pk = true;
    else if (k.ref_table) col.fk = `${k.ref_table}.${k.ref_column}`;
  }

  // Giá trị thật của các cột trạng thái/loại (đọc song song)
  const enumJobs = [];
  for (const [table, cols] of Object.entries(tables)) {
    for (const [name, col] of Object.entries(cols)) {
      if (col.type !== 'text' || !ENUM_COLUMN.test(name)) continue;
      enumJobs.push(
        prisma.$queryRawUnsafe(
          `SELECT "${name}"::text AS v FROM "${table}" WHERE "${name}" IS NOT NULL GROUP BY 1 ORDER BY COUNT(*) DESC LIMIT ${MAX_ENUM_VALUES + 1}`
        ).then(rows => {
          if (rows.length && rows.length <= MAX_ENUM_VALUES) col.values = rows.map(r => r.v);
        }).catch(() => {})
      );
    }
  }
  await Promise.all(enumJobs);
  return tables;
};

const getSchema = async () => {
  if (cache && Date.now() - cacheAt < SCHEMA_TTL_MS) return cache;
  if (!loading) {
    loading = loadSchema()
      .then(s => { cache = s; cacheAt = Date.now(); return s; })
      .finally(() => { loading = null; });
  }
  try {
    return await loading;
  } catch (err) {
    if (cache) return cache; // DB chập chờn: dùng bản cũ
    throw err;
  }
};

/**
 * Mô tả DB dạng gọn cho prompt, chỉ gồm bảng/cột vai trò được đọc.
 * VD: - orders: order_id text PK, customer_id text → customers.customer_id, status text {COMPLETED|SHIPPED|...}, ...
 */
const describeSchemaForRole = async (role) => {
  const group = accessGroupOf(role);
  if (!group) return '';
  const tables = await getSchema();
  const lines = [];
  for (const [table, cols] of Object.entries(tables).sort(([a], [b]) => a.localeCompare(b))) {
    if (!isTableReadable(table, group)) continue;
    const parts = Object.entries(cols)
      .filter(([name]) => isColumnReadable(table, name, group))
      .map(([name, c]) => {
        let s = `${name} ${c.type}`;
        if (c.pk) s += ' PK';
        if (c.fk) s += ` → ${c.fk}`;
        if (c.values) s += ` {${c.values.join('|')}}`;
        return s;
      });
    if (parts.length) lines.push(`- ${table}: ${parts.join(', ')}`);
  }
  return lines.join('\n');
};

/** Danh sách tên cột thật của 1 bảng (dùng cho bộ "chữa tên cột" để không phá cột có thật). */
const getColumnNames = async () => {
  const tables = await getSchema();
  const all = new Set();
  for (const cols of Object.values(tables)) for (const name of Object.keys(cols)) all.add(name);
  return all;
};

const clearSchemaCache = () => { cache = null; cacheAt = 0; };

module.exports = { describeSchemaForRole, getSchema, getColumnNames, clearSchemaCache };
