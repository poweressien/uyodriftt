// Vercel serverless function: POST /api/verify { reference, product }
// Asks Paystack whether the payment really happened, for the right amount, in NGN, and (if Upstash Redis is configured)
// refuses to honour the same reference twice. Needs env PAYSTACK_SECRET_KEY. Optional: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN.
import { PRODUCTS, toKobo } from './_products.js';

const json = (res, code, body) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(body)); };
async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  const chunks = []; for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { return {}; }
}
/** true = this device may have the goods. The first device to present a reference owns it; the same device may ask again (a lost response must not cost the buyer), another device may not. Without Redis nothing is remembered. */
async function claim(ref, device) {
  const url = process.env.UPSTASH_REDIS_REST_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return true;
  const cmd = async c => { const r = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(c) }); if (!r.ok) throw new Error('redis'); return (await r.json()).result; };
  const key = 'ud:' + ref; if ((await cmd(['SET', key, device, 'NX', 'EX', '31536000'])) === 'OK') return true;
  return (await cmd(['GET', key])) === device;
}
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'POST only' });
  const secret = process.env.PAYSTACK_SECRET_KEY; if (!secret) return json(res, 500, { ok: false, error: 'Server is missing PAYSTACK_SECRET_KEY' });
  const { reference, product, device } = await readBody(req);
  if (typeof reference !== 'string' || !/^[\w.=-]{6,100}$/.test(reference)) return json(res, 400, { ok: false, error: 'Bad reference' });
  if (typeof device !== 'string' || !/^[\w-]{8,64}$/.test(device)) return json(res, 400, { ok: false, error: 'Bad device id' });
  if (typeof product !== 'string' || !(product in PRODUCTS)) return json(res, 400, { ok: false, error: 'Unknown product' });
  let pay;
  try {
    const r = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${secret}` } });
    pay = await r.json(); if (!r.ok && r.status !== 400 && r.status !== 404) return json(res, 502, { ok: false, error: 'Paystack unreachable, try again', retry: true });
  } catch { return json(res, 502, { ok: false, error: 'Paystack unreachable, try again', retry: true }); }
  const d = pay && pay.data;
  if (!pay || !pay.status || !d) return json(res, 402, { ok: false, error: 'Payment not found' });
  if (d.status !== 'success') return json(res, 402, { ok: false, error: `Payment ${d.status || 'not completed'}`, retry: d.status === 'pending' || d.status === 'ongoing' });
  if (d.currency !== 'NGN') return json(res, 402, { ok: false, error: 'Wrong currency' });
  if (d.amount < toKobo(PRODUCTS[product])) return json(res, 402, { ok: false, error: 'Amount too low for this product' });
  if (d.metadata && d.metadata.product && d.metadata.product !== product) return json(res, 402, { ok: false, error: 'Payment was for a different product' });
  try { if (!(await claim(reference, device))) return json(res, 409, { ok: false, error: 'This payment was already used' }); } catch { return json(res, 503, { ok: false, error: 'Could not record the payment, try again', retry: true }); }
  return json(res, 200, { ok: true, product, reference });
}
