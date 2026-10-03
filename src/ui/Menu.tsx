import { useEffect, useRef } from 'react';
import { VEHICLES } from '../game/data/vehicles';
import { RANKS, rankFor } from '../game/data/progression';
import { select, dailyStatus, type Save } from '../state/store';
import { CarSvg } from './Bits';
import Showroom, { lookFor } from './Showroom';

export type Go = 'play' | 'garage' | 'multiplayer' | 'career' | 'missions' | 'achievements' | 'ranks' | 'board' | 'settings' | 'quit';
const NAV: [Go, string, string][] = [
  ['play', 'Play', 'Drift run or endless drive'], ['garage', 'Garage', 'Buy, upgrade, paint'], ['multiplayer', 'Multiplayer', 'Race and challenge friends'], ['career', 'Career', 'Events and daily reward'], ['missions', 'Missions', 'Daily and weekly goals'],
  ['achievements', 'Achievements', 'Trophies and rewards'], ['board', 'Leaderboard', 'Your best runs'], ['ranks', 'Ranks', 'XP and unlocks'], ['settings', 'Settings', 'Sound, controls, camera'], ['quit', 'Quit', 'Leave the game'],
];
const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');

/** Home screen: cinematic backdrop and one clean list. Everything else lives on its own screen. */
export default function Menu({ s, onNav, challenge, clearChallenge }: { s: Save; onNav: (k: Go) => void; challenge: { d: string; p: number; n: string } | null; clearChallenge: () => void }) {
  const root = useRef<HTMLDivElement>(null), rank = rankFor(s.xp), sel = s.sel, owned = VEHICLES.filter(v => s.owned[v.id]), vi = Math.max(0, owned.findIndex(v => v.id === sel.vehicle)), v = owned[vi] ?? VEHICLES[0], car = s.owned[v.id];
  const next = RANKS[rank + 1], pct = next ? (s.xp - RANKS[rank].xp) / (next.xp - RANKS[rank].xp) : 1, daily = dailyStatus(s);
  useEffect(() => {
    const el = root.current!, mv = (e: PointerEvent) => { el.style.setProperty('--px', String((e.clientX / innerWidth - .5) * 2)); el.style.setProperty('--py', String((e.clientY / innerHeight - .5) * 2)); };
    addEventListener('pointermove', mv); return () => removeEventListener('pointermove', mv);
  }, []);
  const R = 20, C = 2 * Math.PI * R;
  return (
    <div className="mn" ref={root}>
      <div className="mn-sky" /><div className="mn-stars" /><div className="mn-sun" /><div className="mn-city far" /><div className="mn-city near" /><div className="mn-floor"><i /></div>
      <div className="mn-hero mm-hero"><Showroom look={lookFor(v.id, car)} fallback={<div className="mn-fallback"><CarSvg width={420} color={car?.paint ?? hex(v.color)} decal={car?.decal ?? 'none'} tint={car?.tint ?? 0} wheel="#d8dcde" /></div>} /></div>
      <div className="mn-vig" />
      <header className="mn-top">
        <div className="mn-logo"><span className="u">UYO</span><span className="d">DRIFT</span><div className="mn-flag"><i /><i /><i /></div><small>Akwa Ibom &middot; Street Kings</small></div>
        <div className="mn-me">
          <div className="mn-rank" title={next ? `${s.xp.toLocaleString()} / ${next.xp.toLocaleString()} XP` : 'Top rank'}><svg viewBox="0 0 48 48"><circle cx="24" cy="24" r={R} className="trk" /><circle cx="24" cy="24" r={R} className="val" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} /></svg><b>{rank + 1}</b><span>{RANKS[rank].name}</span></div>
          <div className="mn-coins"><i className="coin" />{s.coins.toLocaleString()}</div>
        </div>
      </header>
      {challenge && <div className="mn-chal"><span>{challenge.n} challenges you: beat <b>{challenge.p.toLocaleString()}</b></span><button onClick={() => onNav('multiplayer')}>Open</button><button onClick={clearChallenge} aria-label="Dismiss">&times;</button></div>}
      <nav className="mm-nav" aria-label="Main menu">
        {NAV.map(([k, l, d], i) => <button key={k} className={k === 'play' ? 'lead' : k === 'quit' ? 'quit' : ''} onClick={() => onNav(k)} style={{ ['--i' as any]: i }}><em>{String(i + 1).padStart(2, '0')}</em><span>{l}<small>{d}</small></span>{k === 'career' && !daily.claimed && <u className="dot" title="Daily reward ready" />}</button>)}
      </nav>
      <aside className="mm-car"><small>{v.kind === 'suv' ? 'SUV' : 'Sedan'}</small><h2>{v.name}</h2>
        {owned.length > 1 && <div className="mm-cycle"><button onClick={() => select({ vehicle: owned[(vi - 1 + owned.length) % owned.length].id })} aria-label="Previous car">&#8249;</button><button onClick={() => select({ vehicle: owned[(vi + 1) % owned.length].id })} aria-label="Next car">&#8250;</button></div>}
      </aside>
    </div>
  );
}
