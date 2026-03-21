import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'pcd_db'
});

async function verifyTables() {
  try {
    const [tables] = await pool.query('SHOW TABLES');
    console.log('\n✅ Tables created in database:');
    console.log('─'.repeat(40));
    tables.forEach((t, i) => {
      const tableName = Object.values(t)[0];
      console.log(`${(i + 1).toString().padStart(2)}. ${tableName}`);
    });
    console.log('─'.repeat(40));
    console.log(`Total: ${tables.length} tables\n`);
    
    // Check custom_roles data
    const [roles] = await pool.query('SELECT COUNT(*) as count FROM custom_roles');
    console.log(`✓ Custom roles inserted: ${roles[0].count}`);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

verifyTables();
