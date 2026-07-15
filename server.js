// master-site server — unified AI MASystem landing page + lead capture + staff gate.
const http = require('http');
const fs = require('fs');
const path = require('path');
const PUBLIC = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' };
const auth = require('./auth');

// Load .env (MASTER_PASS / MASTER_SECRET)
try { const ep = path.join(__dirname, '.env'); if (fs.existsSync(ep)) for (const line of fs.readFileSync(ep, 'utf8').split('\n')) { const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); } } catch {}

function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'Content-Type': type });
  if (Buffer.isBuffer(body)) return res.end(body);
  if (typeof body === 'string') return res.end(body);
  res.end(JSON.stringify(body));
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  async function body() { let b = ''; for await (const c of req) b += c; try { return JSON.parse(b || '{}'); } catch { return {}; } }
  const authed = () => auth.checkToken(req.headers['x-auth-token'] || (req.headers['cookie'] || '').match(/master=([^;]+)/)?.[1] || '');

  // Login
  if (req.method === 'POST' && url.pathname === '/api/login') {
    const b = await body();
    if (auth.checkPass(b.password)) return send(res, 200, { token: auth.makeToken() });
    return send(res, 401, { error: 'unauthorized' });
  }

  // Lead capture -> forward to biz-site
  if (req.method === 'POST' && url.pathname === '/api/lead') {
    const b = await body();
    if (!b.name || !b.email) return send(res, 400, { error: 'name + email required' });
    try {
      await fetch('http://localhost:8070/api/lead', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: b.name, company: b.company || '', email: b.email, phone: b.phone || '', interest: b.interest || '', message: b.message || '' })
      });
      return send(res, 200, { ok: true });
    } catch (e) { return send(res, 500, { ok: false, error: e.message }); }
  }

  // Staff console (gated) — proxies to the unified portal (which has its own auth too)
  if (url.pathname.startsWith('/staff')) {
    if (!authed()) return send(res, 200, LOGIN_HTML, 'text/html');
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 10000);
      const target = 'http://localhost:8080' + (url.pathname === '/staff' ? '/' : url.pathname.replace('/staff', '')) + url.search;
      const r = await fetch(target, {
        method: req.method, headers: { 'Content-Type': 'application/json' },
        body: req.method === 'POST' ? JSON.stringify(await body()) : undefined, signal: ctrl.signal
      });
      clearTimeout(t);
      const buf = Buffer.from(await r.arrayBuffer());
      res.writeHead(r.status, { 'Content-Type': r.headers.get('content-type') || 'text/html' });
      return res.end(buf);
    } catch (e) { return send(res, 502, { error: e.message }); }
  }

  // Static
  let p = url.pathname === '/' ? '/index.html' : url.pathname;
  const fp = path.join(PUBLIC, p);
  if (fs.existsSync(fp) && fs.statSync(fp).isFile()) return send(res, 200, fs.readFileSync(fp), MIME[path.extname(fp)] || 'text/plain');
  return send(res, 404, 'not found');
});

const LOGIN_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>AI MASystem · Staff</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@600;800;900&display=swap" rel="stylesheet">
<style>body{font-family:Inter,system-ui;background:linear-gradient(135deg,#0d1b2a,#1f5fae);height:100vh;display:flex;align-items:center;justify-content:center;margin:0}
.box{background:#fff;padding:32px;border-radius:16px;width:320px;text-align:center;box-shadow:0 20px 60px -30px rgba(0,0,0,.6)}
h3{margin:0 0 14px;color:#0d1b2a;font-size:20px}.dot{display:inline-block;width:10px;height:10px;border-radius:50%;background:#1ba672;margin-right:6px}
input{width:100%;height:42px;border:1px solid #e6ecf3;border-radius:10px;padding:0 12px;font-size:15px;margin-bottom:10px}
button{width:100%;background:#1f5fae;color:#fff;border:none;border-radius:10px;height:44px;font-weight:800;font-size:15px;cursor:pointer}
#err{color:#c0392b;font-size:12px;margin-top:8px;min-height:14px}</style></head>
<body><div class="box"><h3><span class="dot"></span>AI MASystem Staff</h3>
<input id="p" type="password" placeholder="staff password"><button onclick="go()">Sign in</button><div id="err"></div></div>
<script>async function go(){const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:p.value})});if(r.ok){const d=await r.json();localStorage.setItem('master_token',d.token);location.href='/staff';}else err.textContent='wrong password';}</script></body></html>`;

const PORT = 8099;
server.listen(PORT, '0.0.0.0', () => console.log('Master site (AI MASystem) on ' + PORT));
