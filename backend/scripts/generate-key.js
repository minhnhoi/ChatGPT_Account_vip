import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const key = crypto.randomBytes(32).toString("hex");
const envPath = path.join(__dirname, "..", ".env");
const envExamplePath = path.join(__dirname, "..", ".env.example");

const args = process.argv.slice(2);
const writeFlag = args.includes("--write");

console.log("\nENCRYPTION_KEY mới (64 ký tự hex):");
console.log(`ENCRYPTION_KEY=${key}\n`);

if (writeFlag) {
  if (!fs.existsSync(envPath)) {
    if (fs.existsSync(envExamplePath)) {
      fs.copyFileSync(envExamplePath, envPath);
      console.log("Đã tạo file .env từ .env.example");
    } else {
      fs.writeFileSync(envPath, "");
    }
  }

  let envContent = fs.readFileSync(envPath, "utf8");

  if (/^ENCRYPTION_KEY=.*$/m.test(envContent)) {
    envContent = envContent.replace(
      /^ENCRYPTION_KEY=.*$/m,
      `ENCRYPTION_KEY=${key}`,
    );
  } else {
    envContent +=
      (envContent.endsWith("\n") ? "" : "\n") + `ENCRYPTION_KEY=${key}\n`;
  }

  fs.writeFileSync(envPath, envContent);
  console.log(`Đã ghi ENCRYPTION_KEY vào: ${envPath}`);
} else {
  console.log(
    "Copy dòng trên vào backend/.env hoặc chạy: npm run key:write để tự động ghi.\n",
  );
}
