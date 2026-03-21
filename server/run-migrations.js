import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// MySQL Connection
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'pcd_db',
  multipleStatements: true, // Allow multiple statements
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function runMigrations() {
  let connection;
  try {
    console.log('Connecting to MySQL...');
    connection = await pool.getConnection();
    console.log('Connected to MySQL successfully!');

    // List all migration files in order
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      throw new Error('No migration files found in migrations/');
    }

    for (const file of files) {
      const migrationFile = path.join(migrationsDir, file);
      console.log(`\nRunning migration: ${file}`);
      const sql = fs.readFileSync(migrationFile, 'utf8');

      try {
        await connection.query(sql);
        console.log(`✓ ${file} completed`);
      } catch (error) {
        if (error.code === 'ER_TABLE_EXISTS_ERROR' ||
            error.code === 'ER_DUP_ENTRY' ||
            error.code === 'ER_DUP_KEYNAME' ||
            error.message.includes('already exists') ||
            error.message.includes('Duplicate entry')) {
          console.log(`⚠ ${file}: some objects already exist, skipping`);
        } else {
          throw error;
        }
      }
    }

    console.log('\n✅ All migrations completed successfully!');
  } catch (error) {
    console.error('\n❌ Migration failed:');
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      connection.release();
    }
    await pool.end();
  }
}

runMigrations();
