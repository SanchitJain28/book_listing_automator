const { execSync } = require("child_process");

const vpsList = [
  { id: 5,  ip: "69.169.103.19",  pass: "Sanchit@282930" },
  { id: 6,  ip: "200.234.32.63",  pass: "+ww8T@@Eythd/2QM" },
  { id: 7,  ip: "162.35.180.234", pass: "Sanchit@282930" },
  { id: 8,  ip: "104.37.184.22",  pass: "Sanchit@282930" },
  { id: 9,  ip: "162.35.12.38",   pass: "Sanchit@282930" },
  { id: 10, ip: "162.35.180.164", pass: "Sanchit@282930" },
  { id: 11, ip: "162.35.12.37",   pass: "Sanchit@282930" },
];

console.log("==================================================");
console.log("🚀 Launching Round-2 on VPS 5 through 11");
console.log("==================================================\n");

for (const vps of vpsList) {
  console.log(`\n--------------------------------------------------`);
  console.log(`🌐 [VPS ${vps.id}] Connecting to ${vps.ip}...`);

  const cmd = `cd /root/book_listing_automator && git checkout -- . && git pull origin main && bash scripts/vps-run-round2.sh ${vps.id}`;

  try {
    const out = execSync(
      `sshpass -p "${vps.pass}" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=25 root@${vps.ip} "${cmd}"`,
      { encoding: "utf8" }
    );
    console.log(out.trim());
    console.log(`✅ [VPS ${vps.id}] Successfully started!`);
  } catch (err) {
    console.error(`❌ [VPS ${vps.id}] Error: ${err.message}`);
    if (err.stdout) console.log("Stdout:", err.stdout);
    if (err.stderr) console.log("Stderr:", err.stderr);
  }
}

console.log("\n==================================================");
console.log("🎉 All remaining VPS deployments finished!");
console.log("==================================================");
