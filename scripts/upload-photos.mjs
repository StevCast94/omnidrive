import https from 'https';
import { createWriteStream, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

const SUPABASE_URL = 'https://rkwbixidpaqweavghfea.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrd2JpeGlkcGFxd2VhdmdoZmVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzc2NjE5OCwiZXhwIjoyMDkzMzQyMTk4fQ.YhuyGwW8qia858aqMfu3nhPkmLNoIRgdWpQ6AxSvI9U';

const PHOTOS = [
  { file: 'toyota-corolla.jpg', url: 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800&q=80', vehicle: 'Toyota Corolla' },
  { file: 'chevrolet-dmax.jpg', url: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&q=80', vehicle: 'Chevrolet D-MAX' },
  { file: 'yamaha-mt07.jpg', url: 'https://images.unsplash.com/photo-1558981359-219d6364c9c8?w=800&q=80', vehicle: 'Yamaha MT-07' },
  { file: 'bmw-x5.jpg', url: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800&q=80', vehicle: 'BMW X5' },
  { file: 'kia-sportage.jpg', url: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800&q=80', vehicle: 'Kia Sportage' },
  { file: 'honda-civic.jpg', url: 'https://images.unsplash.com/photo-1590362891991-f776e747a588?w=800&q=80', vehicle: 'Honda Civic' },
  { file: 'ford-mustang.jpg', url: 'https://images.unsplash.com/photo-1584345604476-8ec5e12e42dd?w=800&q=80', vehicle: 'Ford Mustang' },
  { file: 'toyota-hilux.jpg', url: 'https://images.unsplash.com/photo-1559416523-140963c9bf4e?w=800&q=80', vehicle: 'Toyota Hilux' },
  { file: 'mazda-cx5.jpg', url: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&q=80', vehicle: 'Mazda CX-5' },
  { file: 'nissan-sentra.jpg', url: 'https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=800&q=80', vehicle: 'Nissan Sentra' },
];

const tmpDir = join(process.cwd(), 'tmp-photos');
mkdirSync(tmpDir, { recursive: true });

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    https.get(url, (resp) => {
      if (resp.statusCode !== 200) {
        reject(new Error(`HTTP ${resp.statusCode} for ${url}`));
        return;
      }
      resp.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => { reject(err); });
  });
}

function uploadToSupabase(filePath, fileName) {
  return new Promise((resolve, reject) => {
    const data = readFileSync(filePath);
    const boundary = randomUUID().replace(/-/g, '');
    let body = '';
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`;
    body += `Content-Type: image/jpeg\r\n\r\n`;
    
    const bodyStart = Buffer.from(body, 'utf-8');
    const bodyEnd = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8');
    const fullBody = Buffer.concat([bodyStart, data, bodyEnd]);

    const opts = {
      hostname: 'rkwbixidpaqweavghfea.supabase.co',
      path: `/storage/v1/object/omnidrive/vehicles/${fileName}`,
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': 'Bearer ' + SERVICE_KEY,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': fullBody.length,
      }
    };

    const req = https.request(opts, (resp) => {
      let b = '';
      resp.on('data', c => b += c);
      resp.on('end', () => {
        if (resp.statusCode < 300) resolve(b);
        else reject(new Error(`Upload failed: ${resp.statusCode} ${b}`));
      });
    });
    req.on('error', reject);
    req.write(fullBody);
    req.end();
  });
}

async function main() {
  console.log('Descargando y subiendo fotos...\n');
  const results = [];
  for (const photo of PHOTOS) {
    const dest = join(tmpDir, photo.file);
    try {
      process.stdout.write(`  ${photo.file} (${photo.vehicle})... `);
      await download(photo.url, dest);
      process.stdout.write('descargado, ');
      const result = await uploadToSupabase(dest, photo.file);
      process.stdout.write('subido\n');
      results.push({
        file: photo.file,
        vehicle: photo.vehicle,
        url: `${SUPABASE_URL}/storage/v1/object/public/omnidrive/vehicles/${photo.file}`
      });
    } catch (err) {
      process.stdout.write(`FALL: ${err.message}\n`);
    }
  }
  console.log('\n=== URLs para seed ===\n');
  for (const r of results) {
    console.log(`"${r.url}", // ${r.vehicle}`);
  }
  console.log(`\n${results.length}/${PHOTOS.length} fotos subidas`);
}

main().catch(console.error);
