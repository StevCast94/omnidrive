// Test login via direct Supabase REST API
const SUPABASE_URL = "https://rkwbixidpaqweavghfea.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrd2JpeGlkcGFxd2VhdmdoZmVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NjYxOTgsImV4cCI6MjA5MzM0MjE5OH0.JnpkukDVuPIvtlBZyHrPFzBReDIVEITrD0uAqGix77U";

async function main() {
  // 1. Sign in with Supabase
  const loginRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": ANON_KEY,
    },
    body: JSON.stringify({
      email: "test@omnidrive.ec",
      password: "Test1234!"
    })
  });

  const loginData = await loginRes.json();
  console.log("Login status:", loginRes.status);
  
  if (!loginData.access_token) {
    console.log("Login failed:", JSON.stringify(loginData, null, 2));
    return;
  }

  const token = loginData.access_token;
  console.log("Token obtained (first 30):", token.slice(0, 30) + "...");

  // 2. Test /api/auth/me with token
  const meRes = await fetch("https://omnidrive-production.up.railway.app/api/auth/me", {
    headers: { "Authorization": `Bearer ${token}` }
  });
  console.log("\n/me status:", meRes.status);
  console.log(JSON.stringify(await meRes.json(), null, 2));
}

main().catch(console.error);
