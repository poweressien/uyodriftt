import { useEffect, useRef } from 'react';
import { DISTRICTS } from '../game/data/districts';
import { VEHICLES } from '../game/data/vehicles';
import { RANKS, rankFor } from '../game/data/progression';
import { select, resetSave, type Save } from '../state/store';
import { MiniMap, CarSvg } from './Bits';
import Showroom, { lookFor } from './Showroom';
import type { Mode } from '../game/data/settings';

type Go = 'garage' | 'missions' | 'achievements' | 'ranks' | 'board' | 'settings';
const NAV: [Go, string][] = [['garage', 'Garage'], ['missions', 'Missions'], ['achievements', 'Achievements'], ['ranks', 'Ranks'], ['board', 'Leaderboard'], ['settings', 'Settings']];
const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');

/** Cinematic main menu: dusk skyline, neon road grid, 3D showroom car, minimal controls. */
export default function Menu({ s, onDrive, onNav, challenge, clearChallenge }: { s: Save; onDrive: () => void; onNav: (k: Go) => void; challenge: { d: string; p: number } | null; clearChallenge: () => void }) {
  const root = useRef<HTMLDivElement>(null), rank = rankFor(s.xp), sel = s.sel, owned = VEHICLES.filter(v => s.owned[v.id]), vi = Math.max(0, owned.findIndex(v => v.id === sel.vehicle)), v = owned[vi] ?? VEHICLES[0], car = s.owned[v.id];
  const dist = DISTRICTS.find(d => d.id === sel.district) ?? DISTRICTS[0], next = RANKS[rank + 1], pct = next ? (s.xp - RANKS[rank].xp) / (next.xp - RANKS[rank].xp) : 1, endless = sel.mode === 'endless';
  const cycle = (d: number) => owned.length > 1 && select({ vehicle: owned[(vi + d + owned.length) % owned.length].id });
  useEffect(() => {
    const el = root.current!, mv = (e: PointerEvent) => { el.style.setProperty('--px', String((e.clientX / innerWidth - .5) * 2)); el.style.setProperty('--py', String((e.clientY / innerHeight - .5) * 2)); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Enter') onDrive(); else if (e.key === 'ArrowLeft') cycle(-1); else if (e.key === 'ArrowRight') cycle(1); };
    addEventListener('pointermove', mv); addEventListener('keydown', key); return () => { removeEventListener('pointermove', mv); removeEventListener('keydown', key); };
  }); // eslint-disable-line
  const stats: [string, number][] = [['Accel', v.accel], ['Handling', v.handling], ['Drift', v.driftControl], ['Top speed', v.topSpeed], ['Brakes', v.brake]];
  const R = 20, C = 2 * Math.PI * R;
  return (
    <div className="mn" ref={root}>
      <div className="mn-sky" /><div className="mn-stars" /><div className="mn-sun" />
      <div className="mn-city far" /><div className="mn-city near" />
      <div className="mn-floor"><i /></div>
      <div className="mn-hero"><Showroom look={lookFor(v.id, car)} fallback={<div className="mn-fallback"><CarSvg width={420} color={car?.paint ?? hex(v.color)} decal={car?.decal ?? 'none'} tint={car?.tint ?? 0} wheel="#d8dcde" /></div>} /></div>
      <div className="mn-vig" />

      <header className="mn-top">
        <div className="mn-logo"><span className="u">UYO</span><span className="d">DRIFT</span><div className="mn-flag"><i /><i /><i /></div><small>Akwa Ibom &middot; Street Kings</small></div>
        <div className="mn-me">
          <div className="mn-rank" title={next ? `${s.xp.toLocaleString()} / ${next.xp.toLocaleString()} XP` : 'Top rank'}>
            <svg viewBox="0 0 48 48"><circle cx="24" cy="24" r={R} className="trk" /><circle cx="24" cy="24" r={R} className="val" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} /></svg><b>{rank + 1}</b>
            <span>{RANKS[rank].name}</span>
          </div>
          <div className="mn-coins"><i className="coin" />{s.coins.toLocaleString()}</div>
        </div>
      </header>

      {challenge && <div className="mn-chal"><span>Beat <b>{challenge.p.toLocaleString()}</b> on {DISTRICTS.find(x => x.id === challenge.d)?.name}</span><button onClick={clearChallenge} aria-label="Dismiss">&times;</button></div>}

      <nav className="mn-nav">{NAV.map(([k, l], i) => <button key={k} onClick={() => onNav(k)} style={{ ['--i' as any]: i }}><em>{String(i + 1).padStart(2, '0')}</em>{l}</button>)}</nav>

      <aside className="mn-car">
        <div className="mn-carhead"><button onClick={() => cycle(-1)} aria-label="Previous car">&#8249;</button><div><small>{v.kind === 'suv' ? 'SUV' : 'Sedan'}</small><h2>{v.name}</h2></div><button onClick={() => cycle(1)} aria-label="Next car">&#8250;</button></div>
        <div className="mn-stats">{stats.map(([n, x]) => <div key={n}><span>{n}</span><i><b style={{ width: `${x * 10}%` }} /></i></div>)}</div>
      </aside>

      <section className="mn-bottom">
        <div className="mn-modes" data-m={sel.mode}><i />{([['drift', 'Drift Run'], ['endless', 'Endless Drive']] as [Mode, string][]).map(([m, l]) => <button key={m} className={sel.mode === m ? 'on' : ''} onClick={() => select({ mode: m })}>{l}</button>)}</div>
        <div className="mn-dists">{DISTRICTS.map(d => { const lock = d.minRank > rank; return (
          <button key={d.id} className={`${d.id === sel.district ? 'on' : ''}${lock ? ' lock' : ''}`} disabled={lock} onClick={() => select({ district: d.id })} title={lock ? `Unlocks: ${RANKS[d.minRank].name}` : d.name}>
            <div className="ring"><MiniMap id={d.id} />{lock && <u>&#128274;</u>}</div><span>{d.name.replace('Championship ', '')}</span>
            <div className="pips">{Array.from({ length: 8 }, (_, i) => <i key={i} className={i < d.difficulty ? 'on' : ''} />)}</div>
          </button>); })}</div>
        <div className="mn-go"><div className="info"><b>{dist.name}</b><span>{endless ? (s.stats.endless_best_m ? `Best ${s.stats.endless_best_m.toLocaleString()} m` : 'No end. 5 hits and you are done.') : '90 seconds. Drift for points.'}</span></div><button className="drive" onClick={onDrive}><span>DRIVE</span><svg viewBox="0 0 40 24"><path d="M2 2l10 10L2 22M16 2l10 10-10 10M30 2l10 10-10 10" /></svg></button></div>
      </section>
      <button className="mn-reset" onClick={() => confirm('Erase all progress on this device?') && resetSave()}>reset progress</button>
    </div>
  );
}
