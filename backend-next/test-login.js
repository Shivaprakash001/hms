async function main() {
  console.log("Logging in with .com ...");
  const loginRes = await fetch("https://trishul.solutions/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "spchidiri2006@gmail.com", password: "Shiva@123", role: "OWNER" })
  });
  
  if (!loginRes.ok) {
    console.error("Login failed:", loginRes.status, await loginRes.text());
    return;
  }
  
  const cookies = loginRes.headers.get("set-cookie");
  console.log("Cookies received!");
  
  console.log("\nFetching GET /api/metrics...");
  const getRes = await fetch("https://trishul.solutions/api/metrics", {
    headers: { "Cookie": cookies }
  });
  
  console.log("Status:", getRes.status);
  console.log(JSON.stringify(await getRes.json(), null, 2));
  
  console.log("\nFetching POST /api/metrics/reset...");
  const resetRes = await fetch("https://trishul.solutions/api/metrics/reset", {
    method: "POST",
    headers: { "Cookie": cookies }
  });
  
  console.log("Status:", resetRes.status);
  console.log(JSON.stringify(await resetRes.json(), null, 2));
}

main();
