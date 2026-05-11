// Create OmniDrive tables in Supabase via Management API
const https = require('https');

const PROJECT = 'rkwbixidpaqweavghfea';
const TOKEN = 'sbp_0cab5e69030b695d21a7569fb10494bb72d0b9db';

function apiQuery(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql });
    const req = https.request({
      hostname: 'api.supabase.com',
      path: `/v1/projects/${PROJECT}/database/query`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('Creating OmniDrive tables...\n');
  
  const tables = [
    // User table
    `CREATE TABLE IF NOT EXISTS public."User" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "authId" UUID UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      "lastName" TEXT NOT NULL,
      "documentType" TEXT NOT NULL,
      "documentId" TEXT UNIQUE NOT NULL,
      "birthDate" TIMESTAMPTZ,
      gender TEXT,
      photo TEXT,
      "walletBalance" DECIMAL NOT NULL DEFAULT 0,
      "driverScore" INTEGER NOT NULL DEFAULT 600,
      "totalTrips" INTEGER NOT NULL DEFAULT 0,
      "subscriptionTier" TEXT NOT NULL DEFAULT 'basic',
      "identityVerified" BOOLEAN NOT NULL DEFAULT false,
      "verifiedAt" TIMESTAMPTZ,
      role TEXT NOT NULL DEFAULT 'tenant',
      language TEXT NOT NULL DEFAULT 'es',
      preferences JSONB NOT NULL DEFAULT '{}',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    
    // UserDocument
    `CREATE TABLE IF NOT EXISTS public."UserDocument" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId" UUID NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      front TEXT NOT NULL,
      back TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT,
      "reviewedAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    
    // Vehicle
    `CREATE TABLE IF NOT EXISTS public."Vehicle" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "ownerId" UUID NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
      brand TEXT NOT NULL,
      model TEXT NOT NULL,
      year INTEGER NOT NULL,
      plate TEXT UNIQUE NOT NULL,
      color TEXT,
      vin TEXT UNIQUE,
      category TEXT NOT NULL DEFAULT 'car',
      seats INTEGER NOT NULL DEFAULT 5,
      transmission TEXT NOT NULL DEFAULT 'manual',
      "fuelType" TEXT NOT NULL DEFAULT 'gasoline',
      "pricePerHour" DECIMAL NOT NULL,
      "pricePerDay" DECIMAL NOT NULL,
      deposit DECIMAL NOT NULL,
      "locationLat" DOUBLE PRECISION NOT NULL,
      "locationLng" DOUBLE PRECISION NOT NULL,
      "locationName" TEXT NOT NULL DEFAULT '',
      insurance BOOLEAN NOT NULL DEFAULT false,
      "withDriver" BOOLEAN NOT NULL DEFAULT false,
      "driverPrice" DECIMAL,
      features JSONB NOT NULL DEFAULT '[]',
      photos JSONB NOT NULL DEFAULT '[]',
      restrictions JSONB,
      rating DECIMAL NOT NULL DEFAULT 0,
      "totalRentals" INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'available',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    
    // Booking
    `CREATE TABLE IF NOT EXISTS public."Booking" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "vehicleId" UUID NOT NULL REFERENCES public."Vehicle"(id),
      "tenantId" UUID NOT NULL REFERENCES public."User"(id),
      "renterId" UUID REFERENCES public."User"(id),
      "withDriver" BOOLEAN NOT NULL DEFAULT false,
      "startAt" TIMESTAMPTZ NOT NULL,
      "endAt" TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      "totalPrice" DECIMAL NOT NULL,
      "depositAmount" DECIMAL NOT NULL DEFAULT 0,
      "paymentMethod" TEXT NOT NULL DEFAULT 'wallet',
      "paidAt" TIMESTAMPTZ,
      "depositedAt" TIMESTAMPTZ,
      "refundedAt" TIMESTAMPTZ,
      "cancelledAt" TIMESTAMPTZ,
      "cancelReason" TEXT,
      rating INTEGER,
      review TEXT,
      "reviewedAt" TIMESTAMPTZ,
      "ownerRating" INTEGER,
      "ownerReview" TEXT,
      "trackingEnabled" BOOLEAN NOT NULL DEFAULT false,
      "trackingData" JSONB,
      "transactionId" UUID,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    
    // Review
    `CREATE TABLE IF NOT EXISTS public."Review" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId" UUID NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
      "bookingId" UUID NOT NULL,
      rating INTEGER NOT NULL,
      comment TEXT,
      tags JSONB NOT NULL DEFAULT '[]',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    
    // Transaction
    `CREATE TABLE IF NOT EXISTS public."Transaction" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId" UUID NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      amount DECIMAL NOT NULL,
      fee DECIMAL NOT NULL DEFAULT 0,
      "paymentMethod" TEXT NOT NULL DEFAULT 'wallet',
      "externalId" TEXT,
      "bookingId" UUID,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    
    // Subscription
    `CREATE TABLE IF NOT EXISTS public."Subscription" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId" UUID NOT NULL UNIQUE REFERENCES public."User"(id) ON DELETE CASCADE,
      tier TEXT NOT NULL DEFAULT 'basic',
      price DECIMAL NOT NULL DEFAULT 0,
      "interval" TEXT NOT NULL DEFAULT 'monthly',
      "startsAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "endsAt" TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      benefits JSONB NOT NULL DEFAULT '[]',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    
    // Notification
    `CREATE TABLE IF NOT EXISTS public."Notification" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId" UUID NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      data JSONB,
      read BOOLEAN NOT NULL DEFAULT false,
      "pushSent" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    
    // PushSubscription
    `CREATE TABLE IF NOT EXISTS public."PushSubscription" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId" UUID NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL,
      keys JSONB NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE("userId", endpoint)
    )`,
  ];
  
  for (const sql of tables) {
    const tableName = sql.match(/"(\w+)"/)[1];
    try {
      const r = await apiQuery(sql);
      if (r.status === 200 || r.status === 201) {
        console.log(`  ✓ ${tableName}`);
      } else {
        console.log(`  ✗ ${tableName}: ${JSON.stringify(r.data).substring(0, 150)}`);
      }
    } catch (e) {
      console.log(`  ✗ ${tableName}: ${e.message}`);
    }
  }
  
  console.log('\nTables created!');
}

main().catch(console.error);
