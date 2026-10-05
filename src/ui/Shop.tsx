import { useState } from 'react';
import { PRODUCTS, ngn, productById, type Product } from '../monetize/products';
import { payMode, adsMode } from '../monetize/config';
import { buy, validEmail, resumePending, payAvailable } from '../monetize/pay';
import { adsAvailable } from '../monetize/ads';
import { watchAd } from '../monetize/watch';
import { useSave, setEmail, addGas, claimFreebie, freebiesLeft, gasView, FREEBIE_COINS, FREEBIE_PER_DAY } from '../state/store';
import { VEHICLES } from '../game/data/vehicles';
import { Header, Coins } from './Bits';
import { pushPopup } from './Popups';
import { uiSound } from '../game/systems/Audio';

const thanks = (p: Product) => p.kind === 'coins' ? `+${(p.coins ?? 0).toLocaleString()} coins` : p.kind === 'gas' ? 'Tank is full' : p.kind === 'car' ? 'Find it in your Garage' : p.kind === 'vip' ? '+25% coins is on' : 'Every cosmetic is open';

/** One button that handles the whole purchase: asks for an email only when Paystack needs it, then pays, then confirms. */
export function BuyButton({ id, label, disabled, onDone, primary }: { id: string; label?: string; disabled?: boolean; onDone?: () => void; primary?: boolean }) {
  const s = useSave(), p = productById(id)!, [ask, setAsk] = useState(false), [em, setEm] = useState(s.ent.email), [busy, setBusy] = useState(false);
  const run = async (email: string) => {
    setBusy(true); const r = await buy(id, email); setBusy(false); setAsk(false);
    if (r.ok) { uiSound('buy'); pushPopup({ kind: 'reward', title: `${r.product.name}: thank you!`, body: thanks(r.product) }); onDone?.(); }
    else if (r.reason !== 'cancelled') { uiSound('error'); pushPopup({ kind: 'reward', title: r.message }); }
  };
  const click = () => { if (payMode() === 'paystack' && !validEmail(s.ent.email)) { setAsk(true); return; } void run(s.ent.email); };
  if (ask) return <div className="emailrow"><input className="txt" type="email" inputMode="email" autoComplete="email" placeholder="Email for your receipt" value={em} onChange={e => setEm(e.target.value)} />
    <button className="btn primary sm" disabled={!validEmail(em)} onClick={() => { setEmail(em); void run(em); }}>Pay {ngn(p.naira)}</button><button className="btn sm quiet" onClick={() => setAsk(false)}>&times;</button></div>;
  return <button className={`btn${primary ? ' primary' : ''}`} disabled={disabled || busy || !payAvailable()} onClick={click}>{busy ? 'Please wait...' : !payAvailable() ? 'Not available' : `${label ?? 'Buy'} ${ngn(p.naira)}`}</button>;
}

const owned = (p: Product, s: ReturnType<typeof useSave>) => p.kind === 'vip' ? s.ent.vip : p.kind === 'style' ? s.ent.style : p.kind === 'car' ? !!p.car && !!s.owned[p.car] : false;

export default function Shop({ onBack }: { onBack: () => void }) {
  const s = useSave(), g = gasView(s), [busy, setBusy] = useState(false), left = freebiesLeft(s), test = payMode() === 'mock' || adsMode() === 'mock';
  const gasAd = async () => { if (busy) return; setBusy(true); const ok = await watchAd('shop_gas'); setBusy(false); if (ok) { addGas(1); uiSound('reward'); pushPopup({ kind: 'reward', title: '+1 gas' }); } };
  const coinAd = async () => { if (busy) return; setBusy(true); const ok = await watchAd('shop_coins'); setBusy(false); if (ok) { try { claimFreebie(); uiSound('reward'); pushPopup({ kind: 'reward', title: `+${FREEBIE_COINS} coins` }); } catch (e: any) { pushPopup({ kind: 'reward', title: e.message }); } } };
  const retry = async () => { const got = await resumePending(); pushPopup({ kind: 'reward', title: got.length ? `Confirmed: ${got.map(x => x.name).join(', ')}` : 'Still waiting for confirmation', body: got.length ? undefined : 'Check your connection and try again' }); };
  const group = (kind: Product['kind'][]) => PRODUCTS.filter(p => kind.includes(p.kind));
  const Card = ({ p }: { p: Product }) => { const has = owned(p, s), car = p.car ? VEHICLES.find(v => v.id === p.car) : null; return (
    <div className={`prod${has ? ' own' : ''}`}><div><b className="cond">{p.name}</b><div className="muted">{p.blurb}</div>{car && <div className="muted">Top speed {car.topSpeed}/10 · brakes {car.brake}/10 · handling {car.handling}/10</div>}</div>
      {has ? <span className="grn cond">Owned</span> : <BuyButton id={p.id} primary={p.kind === 'vip'} disabled={p.kind === 'gas' && g.n >= g.max} />}</div>); };
  return (
    <div className="screen"><Header title="SHOP" onBack={onBack} right={<Coins s={s} />} />
      {test && <div className="panel testbar"><span className="cond hot">Test mode</span> <span className="muted">Ads and payments are simulated. Add your keys to go live (see README).</span></div>}
      {s.ent.pending.length > 0 && <div className="panel testbar"><span className="cond gold">{s.ent.pending.length} payment{s.ent.pending.length > 1 ? 's' : ''} being confirmed</span> <button className="btn sm" onClick={retry}>Retry now</button></div>}
      <div className="list">
        <div className="panel"><div className="cond gold">Free</div>
          <div className="prod"><div><b className="cond">Free coins</b><div className="muted">Watch an ad for +{FREEBIE_COINS} coins. {left} of {FREEBIE_PER_DAY} left today.</div></div><button className="btn sm" disabled={busy || left <= 0 || !adsAvailable()} onClick={coinAd}>{!adsAvailable() ? 'No ads' : left <= 0 ? 'Come back tomorrow' : 'Watch ad'}</button></div>
          <div className="prod"><div><b className="cond">Free gas</b><div className="muted">Watch an ad for +1 gas bar. Gas now {g.n}/{g.max}.</div></div><button className="btn sm" disabled={busy || g.n >= g.max || !adsAvailable()} onClick={gasAd}>{!adsAvailable() ? 'No ads' : 'Watch ad'}</button></div></div>
        <div className="panel"><div className="cond gold">Passes</div>{group(['vip', 'style', 'gas']).map(p => <Card key={p.id} p={p} />)}</div>
        <div className="panel"><div className="cond gold">Premium cars</div>{group(['car']).map(p => <Card key={p.id} p={p} />)}<div className="muted">Premium cars skip the rank requirement and can be upgraded like any other car.</div></div>
        <div className="panel"><div className="cond gold">Coins</div>{group(['coins']).map(p => <Card key={p.id} p={p} />)}</div>
        <div className="muted" style={{ textAlign: 'center', paddingBottom: 6 }}>Payments by Paystack in naira. Purchases stay on this device. Playing never requires paying.</div>
      </div></div>
  );
}
