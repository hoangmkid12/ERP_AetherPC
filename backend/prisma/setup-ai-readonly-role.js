/**
 * Tạo / cập nhật user Postgres CHỈ-ĐỌC dành riêng cho trợ lý AI.
 *
 *   node prisma/setup-ai-readonly-role.js
 *
 * - Role `aether_ai_readonly`: LOGIN, không superuser, mặc định giao dịch read-only,
 *   statement_timeout 5s, tối đa 5 kết nối.
 * - Chỉ được SELECT trên các bảng nghiệp vụ trong schema public, trừ bảng cấu hình /
 *   nhị phân / migrations; với các bảng có cột bí mật (mật khẩu, khuôn mặt, tài
 *   khoản ngân hàng, MST) chỉ được SELECT các cột còn lại (column-level privilege).
 * - Mật khẩu sinh ngẫu nhiên, ghi thẳng vào backend/.env dưới biến
 *   DATABASE_URL_AI_READONLY (không in ra màn hình). Khi deploy, sao chép biến này
 *   sang biến môi trường của server (Railway).
 *
 * Phân quyền chi tiết theo vai trò (Sales/Kho/Kế toán...) vẫn do safeSqlExecutor
 * kiểm tra — role này là lớp chặn cuối ở mức cơ sở dữ liệu.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const prisma = require('../src/config/database');

const ROLE = 'aether_ai_readonly';
const NEVER_TABLES = ['company_settings', 'product_image_blobs', 'chat_attachments', '_prisma_migrations'];
const SECRET_COLUMN = /^(password_hash|password|face_descriptor|face_image|personal_tax_code|bank_account|bank_account_no|bank_account_name)$|token|secret|api_?key|otp/;

const qi = (s) => `"${String(s).replace(/"/g, '""')}"`;

async function main() {
  const password = crypto.randomBytes(24).toString('base64url');
  const tables = (await prisma.$queryRaw`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name`).map(r => r.table_name).filter(t => !NEVER_TABLES.includes(t));
  const columns = await prisma.$queryRaw`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = 'public' ORDER BY table_name, ordinal_position`;
  const colsByTable = columns.reduce((m, c) => ((m[c.table_name] ||= []).push(c.column_name), m), {});

  const exists = (await prisma.$queryRaw`SELECT 1 FROM pg_roles WHERE rolname = ${ROLE}`).length > 0;
  const statements = [];
  statements.push(exists
    ? `ALTER ROLE ${qi(ROLE)} WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 5 PASSWORD '${password}'`
    : `CREATE ROLE ${qi(ROLE)} WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 5 PASSWORD '${password}'`);
  statements.push(`ALTER ROLE ${qi(ROLE)} SET default_transaction_read_only = on`);
  statements.push(`ALTER ROLE ${qi(ROLE)} SET statement_timeout = '5s'`);
  statements.push(`ALTER ROLE ${qi(ROLE)} SET idle_in_transaction_session_timeout = '10s'`);
  // Thu hồi mọi quyền cũ rồi cấp lại đúng phạm vi (chạy lại script là đồng bộ lại)
  statements.push(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${qi(ROLE)}`);
  statements.push(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ${qi(ROLE)}`);
  statements.push(`REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM ${qi(ROLE)}`);
  statements.push(`REVOKE CREATE ON SCHEMA public FROM ${qi(ROLE)}`);
  statements.push(`GRANT USAGE ON SCHEMA public TO ${qi(ROLE)}`);

  const report = [];
  for (const t of tables) {
    const cols = colsByTable[t] || [];
    const secret = cols.filter(c => SECRET_COLUMN.test(c));
    if (secret.length === 0) {
      statements.push(`GRANT SELECT ON TABLE public.${qi(t)} TO ${qi(ROLE)}`);
    } else {
      const allowedCols = cols.filter(c => !SECRET_COLUMN.test(c));
      statements.push(`GRANT SELECT (${allowedCols.map(qi).join(', ')}) ON TABLE public.${qi(t)} TO ${qi(ROLE)}`);
      report.push(`${t}: ẩn ${secret.join(', ')}`);
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const s of statements) await tx.$executeRawUnsafe(s);
  }, { maxWait: 20000, timeout: 120000 });

  // Ghi URL kết nối vào .env (thay host/db từ DATABASE_URL hiện tại)
  const base = new URL(process.env.DATABASE_URL);
  base.username = ROLE;
  base.password = password;
  const envPath = path.join(__dirname, '..', '.env');
  let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const line = `DATABASE_URL_AI_READONLY="${base.toString()}"`;
  env = /^DATABASE_URL_AI_READONLY=.*$/m.test(env)
    ? env.replace(/^DATABASE_URL_AI_READONLY=.*$/m, line)
    : `${env.replace(/\s*$/, '')}\n${line}\n`;
  fs.writeFileSync(envPath, env);

  console.log(`${exists ? 'Đã cập nhật' : 'Đã tạo'} role ${ROLE}: SELECT trên ${tables.length} bảng (bỏ ${NEVER_TABLES.join(', ')}).`);
  console.log('Cột bí mật bị ẩn:\n  ' + report.join('\n  '));
  console.log('Đã ghi DATABASE_URL_AI_READONLY vào backend/.env — nhớ thêm biến này vào môi trường server khi deploy.');
}

main()
  .catch(err => { console.error('LỖI:', err.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
