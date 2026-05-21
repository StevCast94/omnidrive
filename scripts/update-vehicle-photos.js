const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CLOUDINARY_URLS = {
  'honda-cbr500r': 'https://res.cloudinary.com/db3t73yas/image/upload/q_auto:best,f_auto/v1779373304/omnidrive/vehicles/honda-cbr500r.jpg',
  'toyota-hilux': 'https://res.cloudinary.com/db3t73yas/image/upload/q_auto:best,f_auto/v1779373305/omnidrive/vehicles/toyota-hilux.jpg',
  'vw-golf-gti': 'https://res.cloudinary.com/db3t73yas/image/upload/q_auto:best,f_auto/v1779373244/omnidrive/vehicles/vw-golf-gti.jpg',
  'hyundai-staria': 'https://res.cloudinary.com/db3t73yas/image/upload/q_auto:best,f_auto/v1779373306/omnidrive/vehicles/hyundai-staria.jpg',
  'hyundai-tucson': 'https://res.cloudinary.com/db3t73yas/image/upload/q_auto:best,f_auto/v1779373307/omnidrive/vehicles/hyundai-tucson.jpg',
  'kyc-v7': 'https://res.cloudinary.com/db3t73yas/image/upload/q_auto:best,f_auto/v1779373308/omnidrive/vehicles/kyc-v7.jpg',
  'xiaomi-ninebot': 'https://res.cloudinary.com/db3t73yas/image/upload/q_auto:best,f_auto/v1779373308/omnidrive/vehicles/xiaomi-ninebot.jpg',
  'toyota-fortuner': 'https://res.cloudinary.com/db3t73yas/image/upload/q_auto:best,f_auto/v1779373309/omnidrive/vehicles/toyota-fortuner.jpg',
  'jeep-wrangler': 'https://res.cloudinary.com/db3t73yas/image/upload/q_auto:best,f_auto/v1779373310/omnidrive/vehicles/jeep-wrangler.jpg',
  'kia-ev5': 'https://res.cloudinary.com/db3t73yas/image/upload/q_auto:best,f_auto/v1779373259/omnidrive/vehicles/kia-ev5.jpg',
  'jac-js2': 'https://res.cloudinary.com/db3t73yas/image/upload/q_auto:best,f_auto/v1779373311/omnidrive/vehicles/jac-js2.jpg',
  'kia-sportage': 'https://res.cloudinary.com/db3t73yas/image/upload/q_auto:best,f_auto/v1779373312/omnidrive/vehicles/kia-sportage.jpg',
  'chevrolet-sail': 'https://res.cloudinary.com/db3t73yas/image/upload/q_auto:best,f_auto/v1779373322/omnidrive/vehicles/chevrolet-sail.jpg',
  'nissan-sentra': 'https://res.cloudinary.com/db3t73yas/image/upload/q_auto:best,f_auto/v1779373313/omnidrive/vehicles/nissan-sentra.jpg',
  'chevrolet-dmax': 'https://res.cloudinary.com/db3t73yas/image/upload/q_auto:best,f_auto/v1779373313/omnidrive/vehicles/chevrolet-dmax.jpg',
  'toyota-yaris': 'https://res.cloudinary.com/db3t73yas/image/upload/q_auto:best,f_auto/v1779373314/omnidrive/vehicles/toyota-yaris.jpg',
  'mazda-cx5': 'https://res.cloudinary.com/db3t73yas/image/upload/q_auto:best,f_auto/v1779373253/omnidrive/vehicles/mazda-cx5.jpg',
  'ford-ranger': 'https://res.cloudinary.com/db3t73yas/image/upload/q_auto:best,f_auto/v1779373316/omnidrive/vehicles/ford-ranger.jpg',
};

const FIXES = {
  'honda-cbr-500r': CLOUDINARY_URLS['honda-cbr500r'],
  'chevrolet-d-max': CLOUDINARY_URLS['chevrolet-dmax'],
  'volkswagen-golf-gti': CLOUDINARY_URLS['vw-golf-gti'],
  'mazda-cx-5-touring': CLOUDINARY_URLS['mazda-cx5'],
};

async function main() {
  const vehicles = await prisma.vehicle.findMany();
  console.log('Vehicles found:', vehicles.length);
  
  for (const v of vehicles) {
    const key = v.brand.toLowerCase().replace(/[^a-z0-9]/g,'-') + '-' + v.model.toLowerCase().replace(/[^a-z0-9]/g,'-');
    const cleanKey = key.replace(/-+/g,'-').replace(/-+$/,'');
    
    let url = CLOUDINARY_URLS[cleanKey] || FIXES[cleanKey];
    if (!url) {
      for (const [ck, cu] of Object.entries(CLOUDINARY_URLS)) {
        if (cleanKey.includes(ck) || ck.includes(cleanKey)) {
          url = cu;
          break;
        }
      }
    }
    
    if (url) {
      await prisma.vehicle.update({
        where: { id: v.id },
        data: { photos: [url] },
      });
      console.log('UPDATED', v.brand, v.model);
    } else {
      console.log('NO MATCH for', v.brand, v.model, '(key:', cleanKey + ')');
    }
  }
  
  // Verify all have photos
  const all = await prisma.vehicle.findMany();
  const without = all.filter(v => !v.photos || v.photos.length === 0 || !v.photos[0]);
  console.log('\nSin fotos:', without.length);
  for (const v of without) console.log(' MISSING:', v.brand, v.model);
}

main().catch(console.error).finally(() => prisma.$disconnect());
