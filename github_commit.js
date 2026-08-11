const fs = require("fs");
const path = require("path");
const https = require("https");
const readline = require("readline");
const OWNER = "SanchitJain28";
const REPO = "book_listing_automator";
const BRANCH = "main";
const SEARCH_DIR = path.join(__dirname, "output", "amazon-search-term");

function loadEnv() {
  const envPath = path.join(__dirname, ".env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split("\n");
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        process.env[match[1]] = match[2];
      }
    }
  }
}

function apiRequest(method, endpoint, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.github.com",
      path: `/repos/${OWNER}/${REPO}${endpoint}`,
      method: method,
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        "User-Agent": "Book-Listing-Automator-VPS",
        Accept: "application/vnd.github.v3+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    };

    let payload = null;
    if (body) {
      payload = JSON.stringify(body);
      options.headers["Content-Type"] = "application/json";
      options.headers["Content-Length"] = Buffer.byteLength(payload);
    }

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let parsed = null;
        try {
          if (data) parsed = JSON.parse(data);
        } catch (e) {}

        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(parsed);
        } else {
          const err = new Error(
            `GitHub API Error: ${res.statusCode} ${res.statusMessage}`,
          );
          err.status = res.statusCode;
          err.data = parsed;
          reject(err);
        }
      });
    });

    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// --- Main Execution ---
async function run() {
  loadEnv();

  if (!process.env.GITHUB_TOKEN) {
    console.error("❌ Error: GITHUB_TOKEN is not set in .env");
    process.exit(1);
  }

  if (!fs.existsSync(SEARCH_DIR)) {
    console.error(`❌ Error: Output directory not found: ${SEARCH_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(SEARCH_DIR).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    console.log(
      "⚠️ No JSON files found in output directory. Nothing to commit.",
    );
    return;
  }

  // Sort by modified time (latest first)
  files.sort((a, b) => {
    return (
      fs.statSync(path.join(SEARCH_DIR, b)).mtime.getTime() -
      fs.statSync(path.join(SEARCH_DIR, a)).mtime.getTime()
    );
  });

  console.log("\nAvailable files to commit:");
  files.forEach((file, index) => {
    console.log(`  [${index + 1}] ${file}`);
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise((resolve) => {
    rl.question(`\nWhich file do you want to commit? [1]: `, resolve);
  });
  rl.close();

  const selectedIndex = parseInt(answer.trim() || "1") - 1;
  if (
    isNaN(selectedIndex) ||
    selectedIndex < 0 ||
    selectedIndex >= files.length
  ) {
    console.error("❌ Invalid selection.");
    process.exit(1);
  }

  const latestFile = files[selectedIndex];
  const filePath = path.join(SEARCH_DIR, latestFile);
  const repoFilePath = `output/amazon-search-term/${latestFile}`; // Path exactly as it should appear in GitHub

  console.log(`📄 Found latest output file: ${latestFile}`);
  console.log(
    `📦 Size: ${(fs.statSync(filePath).size / 1024 / 1024).toFixed(2)} MB`,
  );

  // 2. Read file and encode to base64
  console.log("🔄 Encoding file to base64...");
  const fileContent = fs.readFileSync(filePath, "base64");

  // 3. Create Blob (This can handle up to 100MB)
  console.log("☁️ Uploading blob to GitHub (this might take a moment)...");
  let blobSha = null;
  let uploadRetries = 3;
  
  while (uploadRetries > 0) {
    try {
      const blobRes = await apiRequest("POST", "/git/blobs", {
        content: fileContent,
        encoding: "base64",
      });
      blobSha = blobRes.sha;
      console.log(`✅ Blob created: ${blobSha}`);
      break;
    } catch (err) {
      if (err.status >= 500 && uploadRetries > 1) {
        console.warn(`⚠️ GitHub server returned ${err.status}. Retrying in 5 seconds...`);
        uploadRetries--;
        await new Promise(res => setTimeout(res, 5000));
      } else {
        throw err;
      }
    }
  }

  // 4. Retry loop to handle concurrent commits from other VPS instances
  let retries = 5;
  while (retries > 0) {
    try {
      console.log(`\n🔍 Fetching latest commit for branch '${BRANCH}'...`);
      const refRes = await apiRequest("GET", `/git/ref/heads/${BRANCH}`);
      const latestCommitSha = refRes.object.sha;

      console.log(`🔍 Fetching base tree...`);
      const commitRes = await apiRequest(
        "GET",
        `/git/commits/${latestCommitSha}`,
      );
      const baseTreeSha = commitRes.tree.sha;

      console.log(`🌳 Creating new tree...`);
      const treeRes = await apiRequest("POST", "/git/trees", {
        base_tree: baseTreeSha,
        tree: [
          {
            path: repoFilePath,
            mode: "100644",
            type: "blob",
            sha: blobSha,
          },
        ],
      });
      const newTreeSha = treeRes.sha;
      console.log(`✅ Tree created: ${newTreeSha}`);

      console.log(`📝 Creating commit...`);
      const newCommitRes = await apiRequest("POST", "/git/commits", {
        message: `Automated upload of latest output: ${latestFile}`,
        tree: newTreeSha,
        parents: [latestCommitSha],
      });
      const newCommitSha = newCommitRes.sha;
      console.log(`✅ Commit created: ${newCommitSha}`);

      console.log(`🚀 Updating branch pointer...`);
      await apiRequest("PATCH", `/git/refs/heads/${BRANCH}`, {
        sha: newCommitSha,
      });

      console.log(`🎉 Successfully committed ${latestFile} to GitHub!`);
      break;
    } catch (err) {
      if (err.status === 422 || err.status === 409) {
        console.warn(
          `⚠️ Conflict detected (another VPS probably just pushed). Retrying... (${retries - 1} attempts left)`,
        );
        retries--;
        // Wait 3 seconds before retrying
        await new Promise((res) => setTimeout(res, 3000));
      } else {
        console.error("❌ Fatal API Error:", err.message);
        if (err.data) console.error(JSON.stringify(err.data, null, 2));
        process.exit(1);
      }
    }
  }

  if (retries === 0) {
    console.error(
      "❌ Failed to commit after maximum retries due to concurrent pushes.",
    );
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("❌ Unexpected Error:", err);
  process.exit(1);
});
