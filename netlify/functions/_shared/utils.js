import { neon } from '@neondatabase/serverless';

export const getSql = () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL no configurada en Netlify.");
  return neon(url);
};

export const onlyDigits = (s) => (s || "").replace(/\D+/g, "");

export async function sha256Hex(input) {
  if (globalThis.crypto?.subtle) {
    const data = new TextEncoder().encode(input);
    const hashBuf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  const { createHash } = await import('crypto');
  return createHash('sha256').update(input).digest('hex');
}

export function jsonRes(status, obj) {
  return { statusCode: status, headers: { "content-type":"application/json" }, body: JSON.stringify(obj) };
}
export function ok(obj) { return jsonRes(200, obj); }
export function bad(msg) { return jsonRes(400, { ok:false, error: msg }); }
export function unauth(msg="Unauthorized") { return jsonRes(401, { ok:false, error: msg }); }
export function fail(e) { return jsonRes(500, { ok:false, error: e.message || String(e) }); }

export function weightForCategory(category="") {
  return /intelligence/i.test(category) ? 2 : 1;
}
