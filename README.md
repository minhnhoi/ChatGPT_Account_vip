Website : https://www.gpt-account.minhptit.id.vn

# AccountHub Vault — React + Bootstrap + Express + MongoDB

Web app dùng để lưu danh sách tài khoản ChatGPT cũ/cá nhân, có giao diện Bootstrap dark theme, thống kê, thêm/sửa/xóa, tìm kiếm/lọc, và phần mật khẩu được mã hóa AES-256-GCM ở backend.

## Tính năng chính

- Tách rõ `frontend/` (React + Vite + Bootstrap) và `backend/` (Express + MongoDB + Mongoose)
- Tự lưu `createdAt`, `updatedAt`; trạng thái mặc định là `new`
- Mật khẩu tài khoản được mã hóa AES-256-GCM trước khi lưu vào MongoDB
- API danh sách **không** trả mật khẩu thật (chỉ trả `passwordMasked`)
- Khi mở web sẽ hiện màn hình nhập mật khẩu admin; có nút **Bỏ qua** để vào chế độ chỉ xem
- Nhập sai 3 lần ở frontend sẽ tự chuyển sang **read-only mode** để tránh thao tác nhạy cảm
- Khi nhập đúng admin, app lưu admin token cục bộ: reload web vẫn giữ quyền cho tới khi bấm **Đăng xuất** hoặc token hết hạn
- Backend khóa API thêm/sửa/xóa/xem mật khẩu bằng `Authorization: Bearer <adminToken>`; vẫn hỗ trợ `X-Admin-Password` để tương thích bản cũ
- So sánh mật khẩu admin theo **timing-safe** (chống timing attack)
- Sửa tài khoản bằng modal, xóa có modal xác nhận (không dùng `confirm()` xấu)
- Dashboard thống kê theo mẫu AccountHub: tổng tài khoản, gói Plus, gói Pro, trạng thái New
- Có đủ sidebar và đã polish từng trang: Tổng quan, Quản lý tài khoản, Gói dịch vụ, Nhật ký hoạt động, Cài đặt, Quản lý Admin, Bảo mật, Sao lưu dữ liệu, Thông báo
- Hiện/ẩn mật khẩu khi nhập form, copy mật khẩu sang clipboard (có fallback cho HTTP)
- Tìm kiếm debounce 350ms, tránh spam API mỗi lần gõ phím
- Tìm kiếm có **escape regex** an toàn — không crash khi user nhập ký tự đặc biệt như `(`, `+`, `*`
- Đã có `data-testid` ở các nút quan trọng, dễ viết test e2e

> Lưu ý: Đây là project cá nhân/local. Nếu deploy public, bạn nên thêm đăng nhập admin thật (JWT/session), HTTPS, phân quyền, audit log và giới hạn IP.

---

## Cấu trúc

```txt
chatgpt-account-vault-secure-bootstrap/
├─ frontend/
│  ├─ src/
│  │  ├─ components/
│  │  │  ├─ accounts/
│  │  │  ├─ common/
│  │  │  └─ dashboard/
│  │  ├─ hooks/
│  │  ├─ pages/
│  │  ├─ services/
│  │  ├─ styles/
│  │  ├─ utils/
│  │  ├─ App.jsx
│  │  └─ main.jsx
│  ├─ index.html
│  ├─ vite.config.js
│  ├─ .env.example
│  └─ package.json
└─ backend/
   ├─ src/
   │  ├─ config/
   │  ├─ controllers/
   │  ├─ middlewares/
   │  ├─ models/
   │  ├─ routes/
   │  ├─ utils/
   │  └─ server.js
   ├─ scripts/
   ├─ .env.example
   └─ package.json
```

---

## Yêu cầu

- **Node.js >= 18** (cần hỗ trợ top-level await và ES Modules)
- **MongoDB** đang chạy ở local (mặc định `mongodb://127.0.0.1:27017`) hoặc URI MongoDB Atlas

---

## Chạy backend

```bash
cd backend
npm install
cp .env.example .env          # macOS/Linux
# copy .env.example .env      # Windows

npm run key:write             # tự sinh ENCRYPTION_KEY và ghi vào .env
# (hoặc: npm run key  -> in ra terminal rồi tự copy vào .env)

npm run dev
```

Trong file `.env`, mật khẩu mặc định trong bản này là `admin123`. Bạn nên đổi `ADMIN_PASSWORD` thành mật khẩu admin riêng của bạn nếu dùng thật.

Backend chạy ở: `http://localhost:5000`

---

## Chạy frontend

```bash
cd frontend
npm install
cp .env.example .env          # macOS/Linux
# copy .env.example .env      # Windows

npm run dev
```

Frontend chạy ở: `http://localhost:5173`

---

## API chính

```txt
GET    /api/health
GET    /api/accounts                    (?search=&status=&planVersion=)
GET    /api/accounts/stats
POST   /api/accounts/admin/verify          (xác minh mật khẩu admin, trả admin token)
POST   /api/accounts                       (cần admin token)
PUT    /api/accounts/:id                   (cần admin token)
DELETE /api/accounts/:id                   (cần admin token)
POST   /api/accounts/:id/reveal-password   (cần admin token, rate-limit 8 req/phút)
GET    /api/activity                       (xem nhật ký hoạt động)
GET    /api/backup/export                  (cần admin token)
POST   /api/backup/import                  (cần admin token)
```

Header cho các thao tác admin:

```txt
Authorization: Bearer <adminToken>
```

Backend vẫn hỗ trợ header cũ nếu cần test nhanh:

```txt
X-Admin-Password: mật khẩu admin trong backend/.env
```

Riêng endpoint verify có thể gửi body:

```json
{ "adminPassword": "admin123" }
```

Response trả về token:

```json
{ "success": true, "data": { "role": "admin", "token": "...", "expiresAt": "..." } }
```

---

## Các biến môi trường backend

| Biến             | Mô tả                                                        |
|------------------|--------------------------------------------------------------|
| `PORT`           | Port chạy backend (mặc định 5000)                            |
| `MONGODB_URI`    | URI kết nối MongoDB                                          |
| `CLIENT_URL`     | Origin cho phép gọi vào API (nhiều origin cách nhau dấu `,`) |
| `ADMIN_PASSWORD` | Mật khẩu mở khóa admin mode, mặc định ví dụ là `admin123`       |
| `ENCRYPTION_KEY` | Khóa AES-256 dạng hex 64 ký tự (sinh từ `npm run key:write`) |

---

## Các thay đổi/tối ưu trong bản refactor này

### Backend
- **Bảo mật**: So sánh mật khẩu admin bằng `crypto.timingSafeEqual` để chống timing attack.
- **Bug fix**: `connectDB` không còn tự gọi `process.exit(1)` mà ném lỗi để bootstrap xử lý tập trung, dễ test.
- **Bug fix**: Search escape các ký tự regex đặc biệt — không còn crash khi user nhập `(`, `+`, `*`, `?`…
- **Mới**: Stats có thêm `upcomingRenewals` (số tài khoản sắp hết hạn trong 30 ngày).
- **Cleanup**: Bỏ duplicate check admin trong `revealPassword` (vì middleware `requireAdmin` đã làm việc đó).
- **Optimize**: Tách `UPDATABLE_FIELDS` ra constant, dùng `mongoose.set('strictQuery', true)`.

### Frontend
- **Bug fix**: `StatCards` giờ hiển thị đúng `upcomingRenewals`, `paidAccounts`, `needsAttention` từ backend (trước đây luôn = 0 vì lấy sai key).
- **Bug fix**: `useAccounts` dùng `useCallback` cho các mutation, giảm re-render không cần thiết.
- **UX fix**: Search trên Navbar không còn auto-redirect sang trang Kho khi user đang ở Dashboard — chỉ chuyển khi nhấn Enter.
- **Testability**: Thêm `data-testid` ở tất cả nút quan trọng (admin gate, form submit, edit/delete/reveal, confirm modal).

### Từ bản trước đó
- `vite.config.js` để Vite compile JSX.
- `renewalDate` không bị reset về `null` khi update mà không gửi field.
- `bootstrap()` trong `server.js` báo lỗi rõ ràng, CORS hỗ trợ nhiều origin.
- AdminGate, read-only mode, debounce search, ESC đóng modal, copy clipboard có fallback.

---

## Ghi chú bảo mật

- Không lưu mật khẩu dạng thô trong MongoDB.
- Không trả mật khẩu trong API danh sách.
- Frontend không lưu `ADMIN_PASSWORD` vào localStorage; chỉ lưu admin token có hạn dùng để tránh phải nhập lại sau khi reload.
- Bấm **Đăng xuất** để xóa admin token khỏi trình duyệt.
- Không commit file `.env` lên GitHub.
- Endpoint reveal password có rate-limit 8 lần / phút / IP.
- So sánh mật khẩu timing-safe để tránh phân tích thời gian.


---

## Bản polish v2.3 này đã xử lý

- Làm lại cực kỳ chỉnh chu cho từng mục điều hướng: hero riêng, metric cards, bảng phụ, filter nhanh và trạng thái rõ ràng.
- Trang **Gói dịch vụ** có phân bổ theo gói, trạng thái, quick filter và bảng gói trả phí mới cập nhật.
- Trang **Nhật ký hoạt động** có filter theo hành động, tìm kiếm log, timeline 8 log mới nhất và bảng audit đầy đủ.
- Trang **Cài đặt hệ thống** có phần API diagnostics, reset filter, tùy chọn hiển thị lưu localStorage và áp dụng default plan/status cho form thêm mới.
- Trang **Quản lý Admin** có ma trận quyền Admin vs Read-only, thời hạn token và checklist quản trị.
- Trang **Bảo mật** có security score, luồng mã hóa 4 bước, checklist bảo mật và cảnh báo dữ liệu rủi ro.
- Trang **Sao lưu dữ liệu** có khu vực backup center, quy trình Export/Store/Key/Import và lưu ý an toàn.
- Trang **Thông báo** gom cảnh báo Expired, sắp hết hạn 7/30 ngày, thiếu ngày gia hạn và tài khoản New.
- Fix lỗi backend `getStats` bị dính đoạn audit log sai vị trí gây crash do biến `account` chưa tồn tại.
- Build frontend đã test OK bằng `npm run build`; backend đã check syntax OK bằng `node --check`.

## Bản fix trước đó đã xử lý

- Fix flow admin: đăng nhập đúng xong reload web vẫn giữ quyền, chỉ mất quyền khi bấm **Đăng xuất** hoặc token hết hạn.
- Fix lỗi thao tác thêm/sửa/xóa dễ bị 401 do frontend gửi password admin trực tiếp từng request; giờ dùng Bearer token.
- Bổ sung validate backend rõ hơn khi thêm tài khoản thiếu `ownerName`, `loginEmail`, `accountName`, `password`.
- Bổ sung status đúng phong cách ảnh mẫu: `New`, `Active`, `Expired`, `Disabled`, `Archived` và vẫn tương thích dữ liệu cũ `in_use`, `old`, `lost`.
- Bổ sung audit log, export/import backup JSON, trang thông báo tài khoản sắp gia hạn.
- Build frontend đã test OK bằng `npm run build`.
- Backend đã check syntax OK bằng `node --check`.

---

## Bản Mongo profile + admin list cleanup

- Tên nhập lần đầu không còn lưu trực tiếp bằng `vault_visitor_name` trong localStorage. Trình duyệt chỉ giữ `vault_visitor_id` + `vault_visitor_token` đã ký để khôi phục đúng hồ sơ trên mobile/cross-domain, còn `displayName`, cài đặt cá nhân và trạng thái đã xem thông báo được lưu trong MongoDB qua `/api/profile`.
- Nếu hồ sơ MongoDB có `displayName = "non"` hoặc chưa có tên, web sẽ hiện màn hình nhập tên trước khi vào hệ thống.
- Đổi tên trong **Cài đặt hệ thống** sẽ thay thế tên cũ trong tài khoản, yêu cầu quyền, chủ sở hữu và audit metadata; không tạo nick/hồ sơ mới.
- Nút **Xóa khỏi list** ở **Quản lý Admin** sẽ ẩn yêu cầu khỏi danh sách admin, đồng thời chuyển trạng thái phía người dùng sang `rejected` để người dùng nhận thông báo admin từ chối quyền.
- Backup v3 đã xuất/nhập thêm `visitorProfiles` và `activityLogs` bên cạnh `accounts`.
- Các bảng dài như Nhật ký hoạt động, Quản lý Admin và Thông báo đã có vùng cuộn với header cố định để không kéo trang quá dài.

## Bản v2.5 — tích hợp Mail OTP

- Thêm điều hướng **Manager OTP** trong frontend.
- Thêm nút **Get OTP** ngay dưới phần tài khoản/mật khẩu trong modal xem pass.
- Khi người dùng mở modal xem pass, backend tự gán nhãn `loginEmail` của tài khoản đó vào hồ sơ MongoDB (`VisitorProfile.otpBinding`).
- Khi bấm **Get OTP**, backend chỉ trả OTP nếu người dùng là admin hoặc đã được cấp quyền đúng tài khoản đó.
- Backend quét mailbox IMAP theo cấu hình, lọc nhiều người gửi OTP mặc định gồm `ChatGPT <noreply@tm.openai.com>` và `<noreply@tm1.openai.com>`, sau đó sắp xếp để trả **OTP mới nhất**. Hệ thống check exact toàn bộ email người nhận, nên `phamname11+23423@gmail.com` và `phamname11+433@gmail.com` là 2 điều kiện khác nhau, không tự bỏ phần `+tag`.
- Cấu hình mail, mã ứng dụng mail, lịch sử lấy OTP đều lưu MongoDB:
  - `MailConfig`: cấu hình IMAP, danh sách sender, mailbox, searchDays, fetchLimit; app password được mã hóa bằng `ENCRYPTION_KEY`.
  - `OtpLog`: toàn bộ lịch sử bind/get OTP theo người dùng/tài khoản/trạng thái.
- Backend có tool riêng chạy ở: `http://localhost:5000/mail-tool` để nhập cấu hình mail, test IMAP và xem lịch sử OTP.
- Backup/export/import đã bao gồm thêm `mailConfigs` và `otpLogs`.

Các API OTP mới:

```txt
GET    /api/otp/config              (admin)
PUT    /api/otp/config              (admin)
POST   /api/otp/config/test         (admin)
GET    /api/otp/logs                (admin xem tất cả, user xem log của mình)
POST   /api/otp/accounts/:id/bind   (admin hoặc user đã được cấp quyền account đó)
POST   /api/otp/accounts/:id/get    (admin hoặc user đã được cấp quyền account đó)
```

Gợi ý cấu hình Gmail:

1. Bật IMAP trong Gmail Settings.
2. Bật 2FA cho tài khoản Google.
3. Tạo App Password cho mail.
4. Vào **Manager OTP** hoặc `http://localhost:5000/mail-tool` để nhập email + app password.


## Bản v2.5.1 — fix OTP mới nhất + Gmail plus address

- Get OTP luôn quét mailbox mới và chọn email mới nhất theo `INTERNALDATE`, fallback theo UID nếu mail không có thời gian.
- Hỗ trợ nhiều sender OpenAI: `noreply@tm.openai.com` và `noreply@tm1.openai.com`. Admin có thể nhập thêm sender, cách nhau bằng dấu phẩy.
- Check người nhận exact, giữ nguyên phần `+tag` trong Gmail alias. Ví dụ `abc+111@gmail.com` sẽ không bị coi là giống `abc+222@gmail.com`.
- Lịch sử OTP ghi rõ sender thực tế, email nhận, thời gian mail và UID để dễ debug khi lấy nhầm/không thấy mã.

## Bản v2.6 — AI chatbox hướng dẫn + footer web chuẩn

- Thêm **AccountHub AI** dạng chatbox nổi ở góc dưới bên phải màn hình.
- Người dùng bấm biểu tượng message để mở chat và hỏi về:
  - vị trí từng mục điều hướng trong sidebar,
  - cách xin quyền / cấp quyền / thu hồi quyền,
  - cách xem email, mật khẩu, Get OTP,
  - Manager OTP, thông báo, cài đặt, backup, bảo mật,
  - dữ liệu lưu MongoDB hay localStorage.
- Chatbox dùng knowledge-base nội bộ của web, không gọi API ngoài và không thay đổi dữ liệu hệ thống.
- Có quick questions, nút điều hướng nhanh từ câu trả lời, copy câu trả lời và lưu lịch sử chat ngắn trong trình duyệt.
- Thêm footer/copyright chuyên nghiệp ở cuối nội dung: copyright, session type, MongoDB-backed, React + Node.js.
- Không chỉnh logic cũ của tài khoản, quyền, OTP, admin token hoặc MongoDB.


## Security hardening added in this build

Bản này vẫn giữ nguyên logic chính của AccountHub, nhưng bổ sung thêm một lớp bảo mật server-side để dùng ổn hơn khi deploy nội bộ/production:

- Admin session được backend set thêm bằng **httpOnly cookie** `account_hub_admin` sau khi đăng nhập admin. Frontend vẫn giữ token cũ để không phá flow hiện tại, nhưng backend ưu tiên đọc cookie nếu có.
- API gọi từ frontend đã bật `credentials: "include"` để cookie bảo mật được gửi kèm request.
- Thêm endpoint `/api/accounts/admin/logout` để xóa cookie admin khi đăng xuất.
- Backend không gửi email đăng nhập thật trong danh sách tài khoản cho người không phải admin. Email thật chỉ trả về khi gọi reveal và đã được backend kiểm tra quyền.
- API nhạy cảm được set `Cache-Control: no-store` để tránh browser/proxy cache nhầm dữ liệu tài khoản, OTP, backup.
- Bổ sung security headers bằng Helmet, tắt `X-Powered-By`, thêm `Referrer-Policy` và `Permissions-Policy`.
- CORS không mở wildcard ở production; dùng `CLIENT_URL` để khai báo frontend origin được phép.
- Có global API rate limit để giảm spam request, ngoài các rate limit sẵn có cho admin login, reveal password và OTP.

### Production note

Khi deploy HTTPS thật, sửa trong `backend/.env`:

```env
NODE_ENV=production
CLIENT_URL=https://domain-frontend-cua-ban.com
ADMIN_COOKIE_SECURE=true
ADMIN_COOKIE_SAMESITE=Strict
```

Nếu frontend và backend khác subdomain/cross-site, có thể phải dùng:

```env
ADMIN_COOKIE_SAMESITE=None
ADMIN_COOKIE_SECURE=true
```

Không commit `.env`, không public `ENCRYPTION_KEY`, `ADMIN_PASSWORD`, Gmail App Password hoặc file backup.

## Bản v2.7 — Production security hardening

Bản này chuyển từ kiểu bảo mật “tool nội bộ” sang hướng deploy production an toàn hơn, nhưng vẫn giữ nguyên luồng chính: quản lý tài khoản, xin quyền, cấp/thu hồi quyền, xem pass, Get OTP, Done OTP, Manager OTP, AI chatbox và MongoDB.

### Điểm đã siết bảo mật

- **Bỏ admin token khỏi localStorage**. Frontend không còn lưu bearer token admin dài hạn trong trình duyệt.
- **Admin session dùng httpOnly cookie**. Cookie không đọc được bằng JavaScript, giảm rủi ro khi có XSS.
- **Thêm CSRF token cho thao tác admin**. Các API admin dạng `POST/PUT/PATCH/DELETE` cần `X-CSRF-Token` hợp lệ ngoài cookie.
- **Visitor identity dùng httpOnly cookie ký HMAC**. `visitorId` không còn phụ thuộc localStorage, production không tin `X-Visitor-Id` nếu không bật legacy flag.
- **Production bắt buộc bcrypt admin hash**. Không dùng mật khẩu admin plain text khi `NODE_ENV=production`.
- **Thêm script tạo hash admin**:

```bash
cd backend
npm run hash:admin -- "mat-khau-admin-that-manh"
```

- **Cookie production có thể dùng tiền tố `__Host-`** để giảm rủi ro cookie bị ghi đè từ subdomain.
- **CSP được bật lại** thay vì tắt hoàn toàn. `/mail-tool` vẫn cho inline CSS/JS vì là tool HTML độc lập, nhưng dữ liệu nhạy cảm vẫn khóa bằng admin cookie + CSRF.
- **CORS chặt hơn**: chỉ cho origin trong `CLIENT_URL`, không dùng wildcard.
- **Rate limit chặt hơn** cho admin login, reveal password, xin quyền và OTP.
- **Security headers**: Helmet, HSTS khi production, frame deny, no-referrer, nosniff, permissions policy.
- **`/mail-tool` không còn lưu admin token**. Tool backend dùng httpOnly cookie + CSRF giống frontend.

### `.env` production khuyến nghị

Nếu frontend và backend cùng site/subdomain, ví dụ:

- `https://app.example.com`
- `https://api.example.com`

có thể dùng:

```env
NODE_ENV=production
PORT=5000
CLIENT_URL=https://app.example.com
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/account-hub
ENCRYPTION_KEY=hex_64_ky_tu_tao_bang_npm_run_key
ADMIN_PASSWORD_HASH=$2b$12$hash_tao_bang_npm_run_hash_admin

# Giữ đăng nhập admin sau khi reload/reset nếu chưa bấm Đăng xuất
ADMIN_SESSION_DAYS=7

ADMIN_COOKIE_NAME=__Host-account_hub_admin
ADMIN_COOKIE_SECURE=true
ADMIN_COOKIE_SAMESITE=Strict
VISITOR_COOKIE_NAME=__Host-account_hub_visitor
VISITOR_COOKIE_SECURE=true
VISITOR_COOKIE_SAMESITE=Strict
VISITOR_COOKIE_MAX_AGE_DAYS=365

ENABLE_CSRF_PROTECTION=true
ALLOW_LEGACY_ADMIN_TOKEN=false
ALLOW_LEGACY_VISITOR_HEADER=false
MAX_JSON_SIZE=1mb
```

Nếu frontend/backend nằm ở hai site khác hẳn nhau và trình duyệt không gửi cookie, đổi cookie SameSite sang:

```env
ADMIN_COOKIE_SAMESITE=None
VISITOR_COOKIE_SAMESITE=None
ADMIN_COOKIE_SECURE=true
VISITOR_COOKIE_SECURE=true
```

### Lưu ý khi migrate từ bản cũ

- Người dùng cũ từng lưu `visitor_id` trong localStorage có thể được tạo profile visitor mới khi deploy production vì bản mới ưu tiên cookie ký HMAC. Đây là đánh đổi để tránh giả mạo visitorId.
- Dữ liệu tài khoản/quyền/OTP trong MongoDB không bị xóa. Nếu muốn giữ mapping user cũ, bật tạm `ALLOW_LEGACY_VISITOR_HEADER=true` trong vài ngày để hệ thống ký lại visitor cookie, sau đó tắt về `false`.
- Admin cần đăng nhập lại một lần sau khi deploy vì token localStorage cũ không còn được dùng.

## Bản v2.7.1 — OTP cooldown theo từng người dùng + từng tài khoản

Bản này thêm lớp chống spam IMAP riêng cho nút **Get OTP**:

- Sau mỗi lần server bắt đầu quét OTP qua mailbox, MongoDB lưu cooldown vào collection `OtpScanCooldown`.
- Cooldown được tính theo cặp `visitorId + accountId`, nên người dùng A lấy OTP tài khoản A sẽ không ảnh hưởng người dùng B hoặc tài khoản khác.
- Nếu quét thành công, không tìm thấy OTP, hoặc mailbox báo lỗi, người dùng vẫn phải chờ hết cooldown trước khi quét lại tài khoản đó.
- Frontend hiển thị đếm ngược ngay trên nút **Get OTP** dạng `Chờ 45s`.
- Backend trả HTTP `429` nếu người dùng bấm quét lại quá sớm.
- Backup/export/import có thêm `otpScanCooldowns` để giữ lịch sử cooldown khi cần restore.

Biến môi trường mới:

```env
# Số giây phải chờ sau mỗi lần quét OTP qua IMAP
OTP_SCAN_COOLDOWN_SECONDS=45
```

Khuyến nghị production cho khoảng 50 người dùng: giữ `OTP_SCAN_COOLDOWN_SECONDS` trong khoảng `45-90` giây để tránh Gmail/IMAP bị spam hoặc rate-limit.


## Bản v2.7.2 — Duy trì đăng nhập admin sau khi F5/reset

Bản này vá thêm phần admin session để dùng ổn hơn khi chạy local và deploy:

- Thêm biến môi trường `ADMIN_SESSION_DAYS` để chỉnh thời gian giữ đăng nhập admin. Mặc định là `7` ngày, tối đa `90` ngày.
- Admin session vẫn dùng **httpOnly cookie** + CSRF, không quay lại lưu admin token trong localStorage.
- Reload/F5, đóng mở lại tab hoặc restart backend vẫn giữ được admin mode nếu cookie còn hạn, `ENCRYPTION_KEY` và `ADMIN_PASSWORD_HASH` không đổi.
- Nếu bấm **Đăng xuất**, backend sẽ xóa cookie admin và bắt nhập lại mật khẩu.
- Khi `NODE_ENV=development`, nếu bạn lỡ đặt `ADMIN_COOKIE_SECURE=true` nhưng đang chạy `http://localhost`, backend sẽ tự hạ Secure về `false` để trình duyệt lưu được cookie local. Production vẫn bắt buộc dùng `Secure=true` qua HTTPS.

Cấu hình local khuyên dùng:

```env
NODE_ENV=development
CLIENT_URL=http://localhost:5173
ADMIN_SESSION_DAYS=7
ADMIN_COOKIE_SECURE=false
ADMIN_COOKIE_SAMESITE=Lax
VISITOR_COOKIE_SECURE=false
VISITOR_COOKIE_SAMESITE=Lax
```

Cấu hình deploy khuyên dùng:

```env
NODE_ENV=production
CLIENT_URL=https://frontend-domain-cua-ban.com
ADMIN_SESSION_DAYS=7
ADMIN_COOKIE_SECURE=true
VISITOR_COOKIE_SECURE=true
ENABLE_CSRF_PROTECTION=true
ALLOW_LEGACY_ADMIN_TOKEN=false
ALLOW_LEGACY_VISITOR_HEADER=false
```

Lưu ý: nếu bạn đổi `ENCRYPTION_KEY` hoặc đổi `ADMIN_PASSWORD_HASH`, cookie admin cũ sẽ bị vô hiệu để đảm bảo an toàn.


## Fix nhanh lỗi ADMIN_PASSWORD_HASH báo sai

Nếu đã dán hash vào `.env` nhưng đăng nhập admin vẫn báo sai, kiểm tra theo đúng thứ tự này:

```bash
cd backend
npm run hash:admin -- "MatKhauAdminCuaBan"
```

Lệnh trên sẽ in ra nguyên dòng dạng:

```env
ADMIN_PASSWORD_HASH="$2a$12$..."
```

Copy nguyên dòng đó vào `backend/.env`, để `ADMIN_PASSWORD=` trống, rồi test:

```bash
npm run check:admin -- "MatKhauAdminCuaBan"
```

Nếu kết quả là `MATCH=true` thì hash đúng. Sau đó tắt backend và chạy lại `npm run dev`.

Lưu ý: mật khẩu nhập trên web là mật khẩu gốc, không phải chuỗi hash. Hash từ chuỗi nào thì phải đăng nhập đúng chuỗi đó, sai 1 ký tự cũng sẽ báo sai.


## Bản v2.7.4 — Realtime sync bằng Socket.IO + polling fallback

Bản này thêm lớp đồng bộ dữ liệu theo thời gian thực nhưng vẫn giữ nguyên các logic cốt lõi cũ. Web không cần F5/reset thủ công sau khi admin hoặc user thao tác.

### Luồng realtime đã thêm

- Admin thêm/sửa/xóa tài khoản → danh sách tài khoản tự cập nhật ở các máy đang mở web.
- User bấm **Xin quyền** → admin thấy yêu cầu mới trong **Quản lý Admin** mà không cần F5.
- Admin cấp quyền/từ chối/thu hồi/xóa khỏi list → user nhận cập nhật quyền/thông báo tự động.
- User lấy OTP và bấm **Done** → chủ sở hữu tài khoản cập nhật realtime.
- Manager OTP và Nhật ký hoạt động tự refetch khi có sự kiện mới.
- Nếu Socket.IO bị rớt mạng, frontend vẫn tự polling nhẹ mỗi khoảng 12 giây.

### Công nghệ realtime

Backend thêm dependency:

```json
"socket.io": "^4.8.3"
```

Frontend thêm dependency:

```json
"socket.io-client": "^4.8.3"
```

Các file realtime chính:

```txt
backend/src/socket.js
frontend/src/services/realtimeService.js
frontend/src/hooks/useRealtimeSync.js
```

### Cấu hình khi deploy Render backend + GitHub Pages frontend

Frontend `.env` khi build GitHub Pages:

```env
VITE_API_URL=https://ten-backend-cua-ban.onrender.com/api
VITE_SOCKET_URL=https://ten-backend-cua-ban.onrender.com
```

Backend `.env` trên Render nếu frontend là GitHub Pages:

```env
NODE_ENV=production
CLIENT_URL=https://ten-github-cua-ban.github.io
ADMIN_COOKIE_SECURE=true
ADMIN_COOKIE_SAMESITE=None
VISITOR_COOKIE_SECURE=true
VISITOR_COOKIE_SAMESITE=None
ENABLE_CSRF_PROTECTION=true
ALLOW_LEGACY_ADMIN_TOKEN=false
ALLOW_LEGACY_VISITOR_HEADER=false
```

Vì GitHub Pages và Render là khác domain, cookie session nên dùng `SameSite=None` + `Secure=true`. Nếu bạn dùng custom domain cùng site, có thể đổi về `Lax`.

Bản mobile fix hiện có thêm lớp dự phòng khi trình duyệt điện thoại chặn cookie cross-domain:

- Visitor dùng `X-Visitor-Token` đã ký để reload vẫn nhận lại đúng hồ sơ/tên đã nhập.
- Admin dùng `X-Admin-Session` trong `sessionStorage` để các thao tác admin trong tab hiện tại không bị rớt về read-only sau khi đăng nhập.
- Cookie httpOnly vẫn là lớp chính nếu trình duyệt cho phép; fallback chỉ giúp GitHub Pages + Render ổn định hơn trên mobile.

### Lưu ý về bảo mật realtime

Socket.IO event chỉ gửi metadata an toàn như `kind`, `accountId`, `status`, thời gian cập nhật. Backend không phát qua socket các dữ liệu nhạy cảm như mật khẩu, OTP code, app password, email nhận OTP thật. Khi nhận event, frontend chỉ refetch lại API cũ, nên quyền server-side vẫn được giữ nguyên.
