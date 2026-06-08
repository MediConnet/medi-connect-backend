import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const sql = readFileSync(resolve(__dirname, 'create-doctor-schedules-table.sql'), 'utf8');

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
});

try {
  await pool.query(sql);
  console.log('✅ Tabla doctor_schedules creada exitosamente');
} catch (err) {
  console.error('❌ Error creando tabla:', err.message);
} finally {
  await pool.end();
}
