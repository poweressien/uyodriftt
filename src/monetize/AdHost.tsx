import { useEffect, useState } from 'react';
import { onMockAd, type MockAd } from './ads';
import { onMockPay, type MockPay } from './pay';
import { ngn } from './products';

/** Development stand-ins for the ad network and the Paystack popup. Only ever mounted visible when a mock mode is active; with real keys they never appear. */
export default function AdHost() {
  const [ad, setAd] = useState<MockAd | null>(null), [pay, setPay] = useState<MockPay | null>(null), [left, setLeft] = useState(5);
  useEffect(() => { onMockAd(a => { setLeft(5); setAd(a); }); onMockPay(p => setPay(p)); return () => { onMockAd(null); onMockPay(null); }; }, []);
  useEffect(() => { if (!ad) return; const t = setInterval(() => setLeft(l => Math.max(0, l - 1)), 1000); return () => clearInterval(t); }, [ad]);
  const closeAd = (watched: boolean) => { ad?.done(watched); setAd(null); };
  const closePay = (paid: boolean) => { pay?.done(paid); setPay(null); };
  return <>
    {ad && <div className="pause mockad" role="dialog" aria-label="Demo ad"><div className="pause-card"><div className="tag">Demo ad &middot; {ad.placement}</div><h2>{left > 0 ? `Reward in ${left}` : 'Reward ready'}</h2>
      <div className="adbar"><i style={{ width: `${(5 - left) / 5 * 100}%` }} /></div>
      <div className="muted">This is a stand-in. With your real ad keys a real video plays here.</div>
      <div className="pause-row"><button className="btn quiet" onClick={() => closeAd(false)}>Skip: no reward</button><button className="btn primary" disabled={left > 0} onClick={() => closeAd(true)}>Claim reward</button></div></div></div>}
    {pay && <div className="pause mockad" role="dialog" aria-label="Demo checkout"><div className="pause-card"><div className="tag">Demo checkout &middot; no real money</div><h2>{pay.product.name}</h2><div className="big-num" style={{ fontSize: 44 }}>{ngn(pay.product.naira)}</div>
      <div className="muted">With your Paystack key the real Paystack popup opens here.</div>
      <div className="pause-row"><button className="btn" onClick={() => closePay(false)}>Cancel</button><button className="btn primary" onClick={() => closePay(true)}>Pay (test)</button></div></div></div>}
  </>;
}
