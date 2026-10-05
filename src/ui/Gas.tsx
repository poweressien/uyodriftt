import { useEffect, useState, useSyncExternalStore } from 'react';
import { useSave, gasView, addGas, fmtWait, type Save } from '../state/store';
import { GAS_MAX } from '../monetize/config';
import { adsAvailable } from '../monetize/ads';
import { watchAd } from '../monetize/watch';
import { pushPopup } from './Popups';
import { uiSound } from '../game/systems/Audio';
import { BuyButton } from './Shop';

export const useNow = (ms = 1000) => { const [n, set] = useState(Date.now()); useEffect(() => { const t = setInterval(() => set(Date.now()), ms); return () => clearInterval(t); }, [ms]); return n; };

let modal = false; const subs = new Set<() => void>();
const set = (v: boolean) => { modal = v; subs.forEach(f => f()); };
export const openGas = () => set(true), closeGas = () => set(false);
const useModal = () => useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f); }; }, () => modal);

/** Seven bars. Tap it to open the gas window. */
export function GasMeter({ s, compact }: { s: Save; compact?: boolean }) {
  const now = useNow(), g = gasView(s, now);
  return <button className={`gas${g.empty ? ' dry' : ''}${compact ? ' sm' : ''}`} onClick={() => { uiSound('tap'); openGas(); }} aria-label={`Gas ${g.n} of ${GAS_MAX}`}>
    <span className="gas-ic">GAS</span><span className="gas-bars">{Array.from({ length: GAS_MAX }, (_, i) => <i key={i} className={i < g.n ? 'on' : ''} />)}</span>{g.empty && <small>{fmtWait(g.msLeft)}</small>}</button>;
}

/** The "refuel" window: wait, watch an ad for one bar, or buy a full tank. Mounted once in App. */
export function GasHost() {
  const open = useModal(), s = useSave(), now = useNow(), g = gasView(s, now), [busy, setBusy] = useState(false);
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => { if (e.key === 'Escape') closeGas(); }; addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [open]);
  if (!open) return null;
  const ad = async () => { if (busy) return; setBusy(true); const ok = await watchAd('gas'); setBusy(false); if (ok) { addGas(1); uiSound('reward'); pushPopup({ kind: 'reward', title: '+1 gas', body: 'Go race!' }); } };
  return <div className="pause" onClick={e => { if (e.target === e.currentTarget) closeGas(); }}><div className="pause-card gasm" role="dialog" aria-label="Gas">
    <h2>{g.empty ? 'OUT OF GAS' : 'GAS'}</h2>
    <div className="gas-big">{Array.from({ length: GAS_MAX }, (_, i) => <i key={i} className={i < g.n ? 'on' : ''} />)}</div>
    <div className="muted" style={{ textAlign: 'center' }}>{g.empty ? <>Tank refills in <b className="gold">{fmtWait(g.msLeft)}</b></> : <>{g.n} of {GAS_MAX} bars. Every race start uses 1 bar.</>}{!s.ent.vip && <div>Turbo Pass: empty tank refills in 90 minutes.</div>}</div>
    <div className="pause-col">
      <button className="btn primary" disabled={busy || g.n >= GAS_MAX || !adsAvailable()} onClick={ad}>{!adsAvailable() ? 'Ads not available' : busy ? 'Loading ad...' : 'Watch an ad: +1 gas'}</button>
      <BuyButton id="gas_full" label="Full tank" disabled={g.n >= GAS_MAX} onDone={closeGas} />
      <button className="btn quiet" onClick={closeGas}>{g.empty ? 'I will wait' : 'Close'}</button>
    </div></div></div>;
}
