const { SignJWT } = require("jose");

async function main() {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET || "default_hms_secret_key_change_me");
  const token = await new SignJWT({
    sub: "00000000-0000-0000-0000-000000000000",
    email: "test@example.com",
    role: "OWNER",
    owner_id: "00000000-0000-0000-0000-000000000000"
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);

  console.log("Token generated.");
  
  const res = await fetch("https://trishul.solutions/api/metrics", {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  console.log("GET /api/metrics status:", res.status);
  console.log(await res.text());
  
  const resetRes = await fetch("https://trishul.solutions/api/metrics/reset", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });
  
  console.log("\nPOST /api/metrics/reset status:", resetRes.status);
  console.log(await resetRes.text());
}
main();
