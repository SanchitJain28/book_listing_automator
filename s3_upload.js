const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const SEARCH_DIR = path.join(__dirname, "output");

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

function getAllJsonFiles(dirPath, arrayOfFiles = []) {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;
  const files = fs.readdirSync(dirPath);
  files.forEach(function (file) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllJsonFiles(fullPath, arrayOfFiles);
    } else {
      if (file.endsWith(".json")) {
        arrayOfFiles.push(fullPath);
      }
    }
  });
  return arrayOfFiles;
}

async function run() {
  loadEnv();

  const bucketName = process.env.AWS_BUCKET_NAME;
  if (!bucketName) {
    console.error("❌ Error: AWS_BUCKET_NAME is not set in .env");
    process.exit(1);
  }

  if (!fs.existsSync(SEARCH_DIR)) {
    console.error(`❌ Error: Output directory not found: ${SEARCH_DIR}`);
    process.exit(1);
  }

  const allFiles = getAllJsonFiles(SEARCH_DIR);
  if (allFiles.length === 0) {
    console.log(
      "⚠️ No JSON files found in output directory. Nothing to upload.",
    );
    return;
  }

  allFiles.sort((a, b) => {
    return fs.statSync(b).mtime.getTime() - fs.statSync(a).mtime.getTime();
  });

  console.log("\nAvailable files to upload to S3:");
  allFiles.forEach((file, index) => {
    const displayPath = path.relative(SEARCH_DIR, file);
    console.log(`  [${index + 1}] ${displayPath}`);
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise((resolve) => {
    rl.question(`\nWhich file do you want to upload? [1]: `, resolve);
  });
  rl.close();

  const selectedIndex = parseInt(answer.trim() || "1") - 1;
  if (
    isNaN(selectedIndex) ||
    selectedIndex < 0 ||
    selectedIndex >= allFiles.length
  ) {
    console.error("❌ Invalid selection.");
    process.exit(1);
  }

  const filePath = allFiles[selectedIndex];
  // Convert local path to S3 object key (e.g. amazon-india/search-term/...)
  const s3Key = path.relative(SEARCH_DIR, filePath).replace(/\\/g, "/");

  console.log(`\n📄 Selected file: ${s3Key}`);
  console.log(
    `📦 Size: ${(fs.statSync(filePath).size / 1024 / 1024).toFixed(2)} MB`,
  );
  console.log(`🚀 Uploading to S3 Bucket '${bucketName}'...`);

  const s3Client = new S3Client({
    region: process.env.AWS_REGION || "ap-south-1",
  });

  try {
    const fileStream = fs.createReadStream(filePath);
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: fileStream,
      ContentType: "application/json",
    });

    await s3Client.send(command);
    console.log(`🎉 Successfully uploaded ${s3Key} to S3!`);
  } catch (error) {
    console.error("❌ Failed to upload to S3:");
    console.error(error.message);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("❌ Unexpected Error:", err);
  process.exit(1);
});
