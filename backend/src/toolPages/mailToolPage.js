export function mailToolPage({ isAdmin = false } = {}) {
  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AccountHub Backend Mail OTP Tool</title>
  <style>
    :root{color-scheme:dark;--bg:#071011;--panel:#0b1719;--panel2:#101f22;--line:#1f3438;--text:#e9fff4;--muted:#86a098;--green:#35f7a2;--red:#ff7070;--yellow:#ffd36b;--blue:#72b7ff}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top left,#0f2b26,#071011 42%),var(--bg);font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;color:var(--text)}main{max-width:1180px;margin:0 auto;padding:28px}.hero{border:1px solid var(--line);border-radius:24px;background:linear-gradient(135deg,rgba(53,247,162,.12),rgba(114,183,255,.08)),var(--panel);padding:24px;display:flex;justify-content:space-between;gap:18px;align-items:center}.eyebrow{color:var(--green);font-weight:800;letter-spacing:.12em;font-size:12px;margin:0 0 6px}.hero h1{margin:0;font-size:30px}.hero p{color:var(--muted);margin:8px 0 0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:18px}.panel{border:1px solid var(--line);border-radius:22px;background:rgba(11,23,25,.9);padding:20px;box-shadow:0 18px 70px rgba(0,0,0,.25)}.panel h2{margin:0 0 14px;font-size:20px}.field{display:flex;flex-direction:column;gap:6px;margin-bottom:12px}.field span{color:var(--muted);font-size:13px;font-weight:700}.input{width:100%;background:#071011;border:1px solid #233b40;color:var(--text);border-radius:14px;padding:12px 14px;outline:none}.input:focus{border-color:var(--green);box-shadow:0 0 0 3px rgba(53,247,162,.12)}.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px}.btn{border:0;border-radius:14px;padding:11px 14px;font-weight:800;cursor:pointer;color:#04100b;background:var(--green)}.btn.ghost{background:#122124;color:var(--text);border:1px solid #2a464c}.btn.warn{background:var(--yellow)}.btn:disabled{opacity:.5;cursor:not-allowed}.alert{padding:12px 14px;border-radius:14px;margin-top:12px;background:#122124;border:1px solid var(--line);color:var(--muted)}.alert.ok{border-color:rgba(53,247,162,.5);color:#bfffe4}.alert.err{border-color:rgba(255,112,112,.5);color:#ffd2d2}.table-wrap{max-height:460px;overflow:auto;border:1px solid var(--line);border-radius:18px}.table{width:100%;border-collapse:collapse;font-size:13px}.table th{position:sticky;top:0;background:#0e1b1e;color:var(--green);text-align:left;z-index:1}.table th,.table td{padding:12px;border-bottom:1px solid #182b2f;vertical-align:top}.badge{display:inline-flex;border-radius:99px;padding:4px 8px;background:#143329;color:var(--green);font-weight:800}.badge.error{background:#351b1f;color:#ff9999}.badge.warn{background:#32280f;color:#ffd36b}.otp{font-size:18px;letter-spacing:.12em;color:var(--green);font-weight:900}.muted{color:var(--muted)}@media(max-width:900px){.grid{grid-template-columns:1fr}.hero{display:block}.row{grid-template-columns:1fr}}
  </style>
</head>
<body>
<main>
  <section class="hero">
    <div>
      <p class="eyebrow">BACKEND MAIL OTP TOOL</p>
      <h1>Quản lý mail IMAP và lịch sử lấy OTP</h1>
      <p>Tool này chạy trực tiếp trên backend. Cấu hình email/mã ứng dụng được lưu MongoDB. Tool lấy OTP mới nhất, check đúng người nhận exact kể cả phần +tag trong Gmail alias.</p>
    </div>
    <div class="actions"><button class="btn ghost" onclick="loadLogs()">Làm mới log</button><button class="btn ghost" onclick="location.href='/api/health'">Health</button></div>
  </section>

  <div class="grid">
    <section class="panel">
      <h2>1) Xác thực admin</h2>
      <label class="field"><span>Mật khẩu admin backend</span><input class="input" id="adminPassword" type="password" placeholder="admin123 hoặc mật khẩu trong .env" /></label>
      <div class="actions"><button class="btn" onclick="loginAdmin()">Mở khóa tool</button><button class="btn ghost" onclick="logoutAdmin()">Đăng xuất cookie</button></div>
      <div id="authMsg" class="alert">${isAdmin ? "Đã có phiên admin cookie. Đang tải cấu hình..." : "Chưa mở khóa. Cần admin để xem/lưu cấu hình mail."}</div>
    </section>

    <section class="panel">
      <h2>2) Cấu hình mailbox</h2>
      <div class="row">
        <label class="field"><span>Email nhận OTP</span><input class="input" id="imapEmail" placeholder="yourmail@gmail.com" /></label>
        <label class="field"><span>Mã ứng dụng mail</span><input class="input" id="appPassword" type="password" placeholder="Nhập khi lưu hoặc đổi mã" /></label>
      </div>
      <div class="row">
        <label class="field"><span>IMAP host</span><input class="input" id="imapHost" value="imap.gmail.com" /></label>
        <label class="field"><span>IMAP port</span><input class="input" id="imapPort" type="number" value="993" /></label>
      </div>
      <div class="row">
        <label class="field"><span>Người gửi OTP, cách nhau bằng dấu phẩy</span><input class="input" id="senderEmail" value="noreply@tm.openai.com, noreply@tm1.openai.com" /></label>
        <label class="field"><span>Mailbox</span><input class="input" id="mailbox" value="INBOX" /></label>
      </div>
      <div class="row">
        <label class="field"><span>Số ngày quét</span><input class="input" id="searchDays" type="number" value="30" /></label>
        <label class="field"><span>Số email tối đa</span><input class="input" id="fetchLimit" type="number" value="300" /></label>
      </div>
      <label class="field"><span><input id="enabled" type="checkbox" /> Bật module lấy OTP</span></label>
      <div class="actions"><button class="btn" onclick="saveConfig()">Lưu cấu hình</button><button class="btn warn" onclick="testConfig()">Test IMAP</button><button class="btn ghost" onclick="loadConfig()">Tải cấu hình</button></div>
      <div id="configMsg" class="alert">Mã ứng dụng sẽ không hiện lại sau khi lưu.</div>
    </section>
  </div>

  <section class="panel" style="margin-top:18px">
    <h2>Lịch sử lấy OTP từ người dùng</h2>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Thời gian</th><th>Trạng thái</th><th>Người dùng</th><th>Tài khoản</th><th>Email nhận</th><th>OTP</th><th>Chi tiết</th></tr></thead>
        <tbody id="logBody"><tr><td colspan="7" class="muted">Chưa tải dữ liệu</td></tr></tbody>
      </table>
    </div>
  </section>
</main>
<script>
  let csrfToken = sessionStorage.getItem('mail_tool_csrf_token') || '';
  function headers(extra={}){return {'Content-Type':'application/json', ...(csrfToken?{'X-CSRF-Token':csrfToken}:{}), ...extra}}
  function msg(id,text,type=''){const el=document.getElementById(id);el.textContent=text;el.className='alert '+type}
  async function parse(res){const data=await res.json().catch(()=>({})); if(!res.ok) throw new Error(data.message||'Request lỗi'); return data}
  function saveCsrf(token=''){csrfToken=token||''; if(csrfToken) sessionStorage.setItem('mail_tool_csrf_token',csrfToken); else sessionStorage.removeItem('mail_tool_csrf_token')}
  async function loadSession(){try{const data=await parse(await fetch('/api/accounts/admin/session',{credentials:'include'})); if(data.data&&data.data.isAdmin){saveCsrf(data.data.csrfToken); msg('authMsg','Đã xác thực bằng httpOnly admin cookie.','ok'); await loadConfig(); await loadLogs(); return true;} msg('authMsg','Chưa có phiên admin cookie. Nhập mật khẩu để mở khóa.'); return false;}catch(e){msg('authMsg',e.message,'err'); return false}}
  async function loginAdmin(){try{const password=document.getElementById('adminPassword').value; const data=await parse(await fetch('/api/accounts/admin/verify',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({adminPassword:password})})); saveCsrf(data.data&&data.data.csrfToken); msg('authMsg','Đã mở khóa admin tool bằng httpOnly cookie.','ok'); document.getElementById('adminPassword').value=''; await loadConfig(); await loadLogs();}catch(e){msg('authMsg',e.message,'err')}}
  async function logoutAdmin(){try{await fetch('/api/accounts/admin/logout',{method:'POST',credentials:'include',headers:headers(),body:'{}'});}catch(e){} saveCsrf(''); msg('authMsg','Đã đăng xuất admin cookie.');}
  function readConfig(){return {imapEmail:imapEmail.value,appPassword:appPassword.value,imapHost:imapHost.value,imapPort:Number(imapPort.value||993),senderEmail:senderEmail.value,senderEmails:senderEmail.value.split(/[;,
]+/).map(x=>x.trim()).filter(Boolean),mailbox:mailbox.value,searchDays:Number(searchDays.value||30),fetchLimit:Number(fetchLimit.value||300),enabled:enabled.checked,useTLS:true}}
  function fillConfig(c={}){imapEmail.value=c.imapEmail||''; imapHost.value=c.imapHost||'imap.gmail.com'; imapPort.value=c.imapPort||993; senderEmail.value=(Array.isArray(c.senderEmails)&&c.senderEmails.length?c.senderEmails.join(', '):c.senderEmail)||'noreply@tm.openai.com, noreply@tm1.openai.com'; mailbox.value=c.mailbox||'INBOX'; searchDays.value=c.searchDays||30; fetchLimit.value=c.fetchLimit||300; enabled.checked=!!c.enabled; appPassword.value=''; msg('configMsg', c.hasAppPassword?'Đã có mã ứng dụng được mã hóa trong MongoDB. Để trống nếu không đổi mã.':'Chưa có mã ứng dụng. Nhập mã ứng dụng rồi lưu.', c.enabled?'ok':'');}
  async function loadConfig(){try{const data=await parse(await fetch('/api/otp/config',{credentials:'include',headers:headers()})); fillConfig(data.data||{});}catch(e){msg('configMsg',e.message,'err')}}
  async function saveConfig(){try{const data=await parse(await fetch('/api/otp/config',{method:'PUT',credentials:'include',headers:headers(),body:JSON.stringify(readConfig())})); fillConfig(data.data||{}); msg('configMsg',data.message||'Đã lưu','ok')}catch(e){msg('configMsg',e.message,'err')}}
  async function testConfig(){try{msg('configMsg','Đang test IMAP...'); const data=await parse(await fetch('/api/otp/config/test',{method:'POST',credentials:'include',headers:headers(),body:'{}'})); fillConfig(data.data||{}); msg('configMsg',data.message||'Test OK','ok')}catch(e){msg('configMsg',e.message,'err')}}
  function esc(value){return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));}
  async function loadLogs(){
    try{
      const data=await parse(await fetch('/api/otp/logs?limit=300',{credentials:'include',headers:headers()}));
      const rows=data.data||[];
      if(!rows.length){
        logBody.innerHTML='<tr><td colspan="7" class="muted">Chưa có lịch sử lấy OTP.</td></tr>';
        return;
      }
      logBody.innerHTML=rows.map(function(r){
        const status=esc(r.status||'-');
        const badgeClass=(r.status==='success'||r.status==='login_confirmed')?'':(['not_found','bound','cooldown','login_not_confirmed'].includes(r.status)?'warn':'error');
        const createdAt=r.createdAt?new Date(r.createdAt).toLocaleString():'-';
        return '<tr>'+
          '<td>'+esc(createdAt)+'</td>'+
          '<td><span class="badge '+badgeClass+'">'+status+'</span></td>'+
          '<td>'+esc(r.requesterName||r.requestedByRole||'-')+'</td>'+
          '<td>'+esc(r.accountName||'-')+'</td>'+
          '<td>'+esc(r.recipientEmail||r.loginEmail||'-')+'</td>'+
          '<td class="otp">'+esc(r.otpCode||'—')+'</td>'+
          '<td><b>'+esc(r.subject||'')+'</b><br><span class="muted">'+esc(r.message||'')+'</span></td>'+
        '</tr>';
      }).join('');
    }catch(e){
      logBody.innerHTML='<tr><td colspan="7" class="muted">'+esc(e.message)+'</td></tr>';
    }
  }
  loadSession();
</script>
</body>
</html>`;
}
