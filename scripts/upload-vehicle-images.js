const cloudinary = require('cloudinary').v2;
cloudinary.config({
  cloud_name: 'db3t73yas',
  api_key: '776765813458392',
  api_secret: 'kqPfILiQ_eK47xChXKMLHAmKqaw',
});

const VEHICLES = [
  { id: 'honda-cbr500r', url: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=800' },
  { id: 'toyota-hilux', url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800' },
  { id: 'vw-golf-gti', url: 'https://images.unsplash.com/photo-1558980394-4c7c9299fe96?w=800' },
  { id: 'hyundai-staria', url: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800' },
  { id: 'hyundai-tucson', url: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800' },
  { id: 'kyc-v7', url: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800' },
  { id: 'xiaomi-ninebot', url: 'https://images.unsplash.com/photo-1558981359-219d6364c9c8?w=800' },
  { id: 'toyota-fortuner', url: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800' },
  { id: 'jeep-wrangler', url: 'https://images.unsplash.com/photo-1551830820-330a71b99659?w=800' },
  { id: 'kia-ev5', url: 'https://images.unsplash.com/photo-1617788138017-80ad40651399?w=800' },
  { id: 'jac-js2', url: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800' },
  { id: 'kia-sportage', url: 'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=800' },
  { id: 'chevrolet-sail', url: 'https://images.unsplash.com/photo-1533106418989-15806d2d3e71?w=800' },
  { id: 'nissan-sentra', url: 'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=800' },
  { id: 'chevrolet-dmax', url: 'https://images.unsplash.com/photo-1583267746897-2cf415887172?w=800' },
  { id: 'toyota-yaris', url: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800' },
  { id: 'mazda-cx5', url: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800' },
  { id: 'ford-ranger', url: 'https://images.unsplash.com/photo-1583267746897-2cf415887172?w=800' },
];

async function uploadAll() {
  for (const v of VEHICLES) {
    try {
      const resp = await fetch(v.url);
      if (!resp.ok) { console.log(`SKIP ${v.id}: ${resp.status}`); continue; }
      const buf = Buffer.from(await resp.arrayBuffer());
      const result = await new Promise((res, rej) => {
        cloudinary.uploader.upload_stream(
          { public_id: v.id, folder: 'omnidrive/vehicles', overwrite: true },
          (e, r) => e ? rej(e) : res(r)
        ).end(buf);
      });
      const url = result.secure_url.replace('/upload/', '/upload/q_auto:best,f_auto/');
      console.log(`OK ${v.id} => ${url}`);
    } catch (e) {
      console.error(`ERR ${v.id}: ${e.message}`);
    }
  }
}

uploadAll().then(() => console.log('\n✅ Done!'));
