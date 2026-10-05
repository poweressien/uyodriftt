/** Real-money checkout (Paystack, naira). Flow: open Paystack popup -> player pays -> we ask our own /api/verify to confirm with Paystack's secret key -> only then grant.
 *  A payment that succeeded but could not be confirmed (no network) is kept in `pending` and retried on every launch, so a buyer never loses what they paid for. */
import { CFG, payMode } from './config';
import { productById, type Product } from './products';
import { getSave, grantProduct, addPending, dropPending } from '../state/store';

export type PayResult = { ok: true; product: Product; ref: string } | { ok: false; reason: 'cancelled' | 'failed' | 'unavailable' | 'pending'; message: string };
export const payAvailable = () => payMode() !== 'none';

export interface MockPay { product: Product; done: (paid: boolean) => void }
let mockListener: ((p: MockPay) => void) | null = null;
export const onMockPay = (f: ((p: MockPay) => void) | null) => { mockListener = f; };

const newRef = (id: string) => `UD-${id}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
let psLoad: Promise<boolean> | null = null;
function loadPaystack() {
  if (psLoad) return psLoad;
  psLoad = new Promise(res => { if ((window as any).PaystackPop) return res(true); const s = document.createElement('script'); s.src = 'https://js.paystack.co/v1/inline.js'; s.onload = () => res(true); s.onerror = () => { psLoad = null; res(false); }; document.head.appendChild(s); setTimeout(() => res(!!(window as any).PaystackPop), 10000); });
  return psLoad;
}
async function verify(ref: string, product: string): Promise<{ ok: boolean; retry?: boolean; error?: string }> {
  try {
    const r = await fetch(`${CFG.apiBase}/api/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reference: ref, product, device: getSave().ent.device }) });
    const o = await r.json().catch(() => ({})); return { ok: !!o.ok, retry: !!o.retry || r.status >= 500, error: o.error };
  } catch { return { ok: false, retry: true, error: 'No connection' }; }
}
const valid = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
export const validEmail = valid;

/** Buy one product. `email` is required by Paystack for the receipt. */
export async function buy(productId: string, email: string): Promise<PayResult> {
  const product = productById(productId), mode = payMode(); if (!product) return { ok: false, reason: 'failed', message: 'Unknown product' };
  if (mode === 'none') return { ok: false, reason: 'unavailable', message: 'Payments are not switched on in this build' };
  const ref = newRef(productId);
  if (mode === 'mock') {
    if (!mockListener) return { ok: false, reason: 'unavailable', message: 'Payments are not available' };
    const paid = await new Promise<boolean>(res => mockListener!({ product, done: res })); if (!paid) return { ok: false, reason: 'cancelled', message: 'Payment cancelled' };
    return grantProduct(productId, ref) ? { ok: true, product, ref } : { ok: false, reason: 'failed', message: 'Could not apply the purchase' };
  }
  if (!valid(email)) return { ok: false, reason: 'failed', message: 'Enter a valid email for your receipt' };
  if (!(await loadPaystack())) return { ok: false, reason: 'unavailable', message: 'Could not load Paystack. Check your connection.' };
  const paid = await new Promise<'paid' | 'closed'>(res => {
    let settled = false; const fin = (v: 'paid' | 'closed') => { if (!settled) { settled = true; res(v); } };
    try {
      const h = (window as any).PaystackPop.setup({ key: CFG.paystackKey, email, amount: product.naira * 100, currency: 'NGN', ref, metadata: { product: productId, device: getSave().ent.device, custom_fields: [{ display_name: 'Item', variable_name: 'item', value: product.name }] }, callback: () => fin('paid'), onClose: () => fin('closed') });
      h.openIframe();
    } catch { fin('closed'); }
  });
  if (paid === 'closed') return { ok: false, reason: 'cancelled', message: 'Payment cancelled. You were not charged.' };
  addPending(ref, productId); return settle(ref, productId, product);
}
async function settle(ref: string, productId: string, product: Product): Promise<PayResult> {
  const v = await verify(ref, productId);
  if (v.ok) { return grantProduct(productId, ref) ? { ok: true, product, ref } : { ok: false, reason: 'failed', message: 'Already applied' }; }
  if (v.retry) return { ok: false, reason: 'pending', message: 'Payment received. We could not confirm it yet: it will finish automatically when you are back online.' };
  dropPending(ref); return { ok: false, reason: 'failed', message: v.error || 'Payment could not be confirmed' };
}
/** Try again for every payment that was paid but never confirmed. Returns the products that were granted just now. */
export async function resumePending(): Promise<Product[]> {
  const got: Product[] = [];
  for (const p of [...getSave().ent.pending]) { const product = productById(p.product); if (!product) { dropPending(p.ref); continue; } const r = await settle(p.ref, p.product, product); if (r.ok) got.push(product); }
  return got;
}
