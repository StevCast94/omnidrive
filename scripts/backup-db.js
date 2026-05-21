// scripts/backup-db.js
// Backup de la BD de OmniDrive a Cloudinary como archivo SQL
// Uso: cd backend && node ../scripts/backup-db.js
// Requiere: DATABASE_URL en .env + CLOUDINARY credenciales

const { PrismaClient } = require('@prisma/client');
const cloudinary = require('cloudinary').v2;
const path = require('path');
const fs = require('fs');
const os = require('os');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'db3t73yas',
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function backup() {
  const prisma = new PrismaClient();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  const filename = `omnidrive-backup-${timestamp}.sql`;
  const tmpPath = path.join(os.tmpdir(), filename);

  console.log(`📦 Backing up OmniDrive database...`);
  console.log(`   File: ${filename}`);

  // Get all tables data via Prisma
  const tables = ['User', 'Vehicle', 'Booking', 'Subscription', 'Notification', 
                  'Conversation', 'Message', 'Review', 'Payment', 'Tracking',
                  'InventoryItem', 'InventoryUsage', 'PasswordResetToken'];
  
  let sql = `-- OmniDrive Database Backup\n`;
  sql += `-- Generated: ${new Date().toISOString()}\n`;
  sql += `-- Server: Railway PostgreSQL\n\n`;
  sql += `BEGIN;\n\n`;

  for (const table of tables) {
    try {
      const rows = await prisma.$queryRawUnsafe(`SELECT * FROM public."${table}"`);
      if (!rows || rows.length === 0) {
        console.log(`   ⏭️  ${table}: 0 rows`);
        continue;
      }

      // Get column names from first row
      const columns = Object.keys(rows[0]);
      const cols = columns.map(c => `"${c}"`).join(', ');

      sql += `-- ${table}: ${rows.length} rows\n`;
      
      for (const row of rows) {
        const vals = columns.map(col => {
          const val = row[col];
          if (val === null || val === undefined) return 'NULL';
          if (typeof val === 'boolean') return val ? 'true' : 'false';
          if (typeof val === 'number') return val.toString();
          if (val instanceof Date) return `'${val.toISOString()}'`;
          // Escape single quotes
          return `'${String(val).replace(/'/g, "''")}'`;
        });
        sql += `INSERT INTO public."${table}" (${cols}) VALUES (${vals.join(', ')});\n`;
      }
      sql += '\n';
      console.log(`   ✅ ${table}: ${rows.length} rows`);
    } catch (err) {
      console.log(`   ⚠️  ${table}: ${err.message}`);
    }
  }

  sql += `COMMIT;\n`;

  // Write to temp file
  fs.writeFileSync(tmpPath, sql, 'utf8');
  console.log(`\n   ✅ Backup written to temp file (${(fs.statSync(tmpPath).size / 1024).toFixed(1)} KB)`);

  // Upload to Cloudinary
  console.log(`   📤 Uploading to Cloudinary...`);
  const result = await new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      tmpPath,
      {
        resource_type: 'raw',
        folder: 'omnidrive/backups',
        public_id: `backup-${timestamp}`,
        use_filename: true,
        unique_filename: false,
        overwrite: true,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
  });

  // Cleanup temp file
  fs.unlinkSync(tmpPath);

  console.log(`   ✅ Uploaded to Cloudinary:`);
  console.log(`      ${result.secure_url}`);
  console.log(`\n✨ Backup complete!`);

  // Optionally verify by downloading and checking format
  console.log(`   📝 Backup size: ${(result.bytes / 1024).toFixed(1)} KB`);

  await prisma.$disconnect();
  return result.secure_url;
}

backup().catch(err => {
  console.error(`\n❌ Backup failed:`, err.message);
  process.exit(1);
});
