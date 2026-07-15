// auth.js — HMAC-signed admin token auth for the master MASystem site.
const crypto = require('crypto');
const SECRET = process.env.MASTER_SECRET || 'change-this-master-secret-to-a-long-random-string';
const PASS = process.env.MASTER_PASS || 'ShreeAuto@2026';
function makeToken() {
  const exp = Date.now() + 12 * 3600 * 1000; // 12h
  const body = Buffer.from(JSON.stringify({ exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}
function checkToken(tok) {
  if (!tok || !tok.includes('.')) return false;
  try {
    const [body, sig] = tok.split('.');
    const expect = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
    if (expect !== sig) return false;
    const { exp } = JSON.parse(Buffer.from(body, 'base64url').toString());
    return exp > Date.now();
  } catch { return false; }
}
function checkPass(p) { return p === PASS; }
module.exports = { makeToken, checkToken, checkPass };
