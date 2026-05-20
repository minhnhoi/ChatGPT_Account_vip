import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

function cleanHash(value = "") {
  return String(value || "")
    .trim()
    .replace(/^\uFEFF/, "")
    .replace(/^['"]|['"]$/g, "")
    .trim();
}

const password = process.argv.slice(2).join(" ");
const hash = cleanHash(
  process.env.ADMIN_PASSWORD_HASH || process.env.ADMIN_PASSWORD || "",
);

if (!password) {
  console.error('Cách dùng: npm run check:admin -- "mat-khau-can-test"');
  process.exit(1);
}

if (!hash) {
  console.error("Không thấy ADMIN_PASSWORD_HASH trong backend/.env");
  process.exit(1);
}

const isBcrypt = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(hash);
const match = isBcrypt
  ? await bcrypt.compare(password, hash)
  : password === hash;

console.log("ENV_HASH_PREFIX=", hash.slice(0, 7));
console.log("ENV_HASH_LENGTH=", hash.length);
console.log("IS_BCRYPT=", isBcrypt);
console.log("MATCH=", match);

if (!match) {
  console.log("\nHash trong .env KHÔNG khớp với mật khẩu bạn vừa nhập.");
  console.log('Hãy tạo lại bằng: npm run hash:admin -- "mật-khẩu-đúng"');
}
