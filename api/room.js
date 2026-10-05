// Vercel serverless function: short room codes for live races (optional; the game falls back to copy/paste codes without it).
// POST /api/room  {action:'ping'|'create'|'join'|'answer'|'poll', ...}. Needs Upstash Redis: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN.
const json = (res, code, body) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(body)); };
async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  const chunks = []; for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { return {}; }
}
const enabled = () => !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
async function redis(cmd) {
  const r = await fetch(process.env.UPSTASH_REDIS_REST_URL, { method: 'POST', headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  if (!r.ok) throw new Error('redis ' + r.status); return (await r.json()).result;
}
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', newCode = () => Array.from({ length: 5 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');
const okCode = c => typeof c === 'string' && /^[A-Z2-9]{5}$/.test(c), okBlob = s => typeof s === 'string' && s.length > 20 && s.length < 6000 && /^[\w-]+$/.test(s);
const TTL = 600;
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'POST only' });
  const b = await readBody(req), a = b.action;
  if (a === 'ping') return json(res, 200, { ok: true, enabled: enabled() });
  if (!enabled()) return json(res, 503, { ok: false, error: 'Rooms are not set up on this server' });
  try {
    if (a === 'create') {
      if (!okBlob(b.offer)) return json(res, 400, { ok: false, error: 'Bad offer' });
      for (let i = 0; i < 6; i++) { const code = newCode(); if ((await redis(['SET', 'room:' + code, JSON.stringify({ offer: b.offer, answer: null }), 'NX', 'EX', String(TTL)])) === 'OK') return json(res, 200, { ok: true, code }); }
      return json(res, 503, { ok: false, error: 'Could not make a room code, try again' });
    }
    if (!okCode(b.code)) return json(res, 400, { ok: false, error: 'Room codes are 5 letters or numbers' });
    const raw = await redis(['GET', 'room:' + b.code]); if (!raw) return json(res, 404, { ok: false, error: 'Room not found or expired' });
    const room = JSON.parse(raw);
    if (a === 'join') return json(res, 200, { ok: true, offer: room.offer, taken: !!room.answer });
    if (a === 'answer') { if (!okBlob(b.answer)) return json(res, 400, { ok: false, error: 'Bad answer' }); if (room.answer) return json(res, 409, { ok: false, error: 'Someone already joined this room' }); room.answer = b.answer; await redis(['SET', 'room:' + b.code, JSON.stringify(room), 'EX', String(TTL)]); return json(res, 200, { ok: true }); }
    if (a === 'poll') { if (room.answer) await redis(['DEL', 'room:' + b.code]); return json(res, 200, { ok: true, answer: room.answer }); }
    return json(res, 400, { ok: false, error: 'Unknown action' });
  } catch { return json(res, 502, { ok: false, error: 'Room service error, try again' }); }
}
