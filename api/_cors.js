// CORS for the native app. Inside the Capacitor Android WebView the page origin is https://localhost, so calls to your deployed API are cross-origin.
// Only the app's own origins (plus ALLOWED_ORIGINS, comma separated, if you set it) get an answer header; the website itself is same-origin and needs none.
const BASE = ['https://localhost', 'capacitor://localhost', 'http://localhost'];
/** Returns true when the request was a preflight and has already been answered. */
export function cors(req, res) {
  const origin = req.headers.origin, allowed = [...BASE, ...String(process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)];
  if (origin && allowed.includes(origin)) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); res.setHeader('Access-Control-Max-Age', '86400'); }
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return true; }
  return false;
}
