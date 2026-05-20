import bcrypt from "bcryptjs";

const password = process.argv.slice(2).join(" ");

if (!password) {
  console.error('Cách dùng: npm run hash:admin -- "mat-khau-admin-manh"');
  process.exit(1);
}

if (password.length < 12) {
  console.error("Mật khẩu production nên dài ít nhất 12 ký tự.");
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
const ok = await bcrypt.compare(password, hash);

console.log("\nCopy nguyên dòng dưới vào backend/.env:");
console.log(`ADMIN_PASSWORD_HASH=${JSON.stringify(hash)}`);
console.log("\nTest hash vừa tạo:", ok ? "MATCH=true" : "MATCH=false");
console.log(
  "Mật khẩu đăng nhập admin là đúng chuỗi bạn vừa truyền vào lệnh, không phải chuỗi hash.",
);
