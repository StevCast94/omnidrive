import https from 'https';

const SUPABASE_URL = 'https://rkwbixidpaqweavghfea.supabase.co';
const SK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrd2JpeGlkcGFxd2VhdmdoZmVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzc2NjE5OCwiZXhwIjoyMDkzMzQyMTk4fQ.YhuyGwW8qia858aqMfu3nhPkmLNoIRgdWpQ6AxSvI9U';
const STORAGE_URL = SUPABASE_URL + '/storage/v1/object/public/omnidrive/vehicles/';

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'rkwbixidpaqweavghfea.supabase.co',
      path: '/rest/v1/' + path,
      method,
      headers: {
        'apikey': SK, 'Authorization': 'Bearer ' + SK,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      }
    };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const req = https.request(opts, (resp) => {
      let b = '';
      resp.on('data', c => b += c);
      resp.on('end', () => {
        if (resp.statusCode < 300) resolve(b);
        else reject(new Error(`${resp.statusCode}: ${b.slice(0,200)}`));
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  // 1. Ver qué vehículos existen
  console.log('Vehículos actuales:');
  const existing = await api('GET', 'Vehicle?select=id,plate,brand,model&order=id');
  const list = JSON.parse(existing);
  for (const v of list) {
    console.log(`  ${v.id.slice(0,8)} - ${v.brand} ${v.model} (${v.plate})`);
  }

  // 2. Actualizar fotos a los que no tienen
  console.log('\nActualizando fotos...');
  const photoMap = {
    'Toyota': STORAGE_URL + 'toyota-corolla.jpg',
    'Chevrolet': STORAGE_URL + 'chevrolet-dmax.jpg',
    'Yamaha': STORAGE_URL + 'yamaha-mt07.jpg',
    'BMW': STORAGE_URL + 'bmw-x5.jpg',
    'Kia': STORAGE_URL + 'kia-sportage.jpg',
  };
  for (const v of list) {
    const photo = photoMap[v.brand];
    if (photo) {
      try {
        await api('PATCH', `Vehicle?id=eq.${v.id}`, { photos: [photo] });
        console.log(`  ✅ Foto actualizada: ${v.brand} ${v.model}`);
      } catch (e) {
        console.log(`  ❌ ${v.brand} ${v.model}: ${e.message}`);
      }
    }
  }

  // 3. Verificar la dueña Maria y Pedro existen
  console.log('\nVerificando usuarios nuevos...');
  const users = JSON.parse(await api('GET', 'User?select=id,email'));
  for (const u of users) {
    console.log(`  ${u.email} (${u.id.slice(0,8)})`);
  }

  console.log('\n✅ Done');
}

main().catch(console.error);
