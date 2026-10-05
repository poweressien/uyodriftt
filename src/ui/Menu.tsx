import { VEHICLES } from '../game/data/vehicles';
import { RANKS, rankFor } from '../game/data/progression';
import { DISTRICTS, endlessRoad } from '../game/data/districts';
import { select, dailyStatus, type Save } from '../state/store';
import { raceName } from '../game/data/races';
import PlazaScene from './PlazaScene';
import { GasMeter } from './Gas';

export type Go = 'challenge' | 'online' | 'friend' | 'classic' | 'endless' | 'career' | 'play' | 'shop' | 'garage' | 'missions' | 'achievements' | 'ranks' | 'board' | 'settings' | 'quit';
/** The six ways to play, big. Everything else lives in the small dock at the bottom. */
const NAV: [Go, string, string][] = [
  ['challenge', 'Challenge', 'Race, eliminate, wreck'], ['online', 'Online Race', 'Live with a friend'], ['friend', 'Friend Link', 'Send a score to beat'], ['classic', 'Classic', 'Drift run, 90 seconds'], ['endless', 'Endless', 'A road with no end'], ['career', 'Career', 'Events and daily reward'],
];
const DOCK: [Go, string][] = [['garage', 'Garage'], ['shop', 'Shop'], ['missions', 'Missions'], ['achievements', 'Trophies'], ['ranks', 'Ranks'], ['board', 'Board'], ['settings', 'Settings'], ['quit', 'Quit']];

/** Home screen: night view of the Ibom Plaza roundabout, a slanted menu rail on the left and a big START on the right. */
export default function Menu({ s, onNav, challenge, clearChallenge }: { s: Save; onNav: (k: Go) => void; challenge: { d: string; p: number; n: string } | null; clearChallenge: () => void }) {
  const rank = rankFor(s.xp), owned = VEHICLES.filter(v => s.owned[v.id]), vi = Math.max(0, owned.findIndex(v => v.id === s.sel.vehicle)), v = owned[vi] ?? VEHICLES[0];
  const next = RANKS[rank + 1], pct = next ? (s.xp - RANKS[rank].xp) / (next.xp - RANKS[rank].xp) : 1, daily = dailyStatus(s);
  const dist = DISTRICTS.find(d => d.id === s.sel.district) ?? DISTRICTS[0], endless = s.sel.mode === 'endless', raceLbl = raceName(s.sel.mode);
  const cycle = (n: number) => select({ vehicle: owned[(vi + n + owned.length) % owned.length].id });
  return (
    <div className="hm">
      <PlazaScene />
      <header className="hm-top">
        <div className="hm-logo"><small>Akwa Ibom street racing</small><b>UYO DRIFT</b><i /><em>Land of promise</em></div>
        <div className="hm-me">
          <div className="hm-chip" title={next ? `${s.xp.toLocaleString()} / ${next.xp.toLocaleString()} XP` : 'Top rank'}><b>{rank + 1}</b><span>{RANKS[rank].name}<em><i style={{ width: `${pct * 100}%` }} /></em></span></div>
          <GasMeter s={s} /><div className="hm-chip coins"><i className="coin" />{s.coins.toLocaleString()}</div>
        </div>
      </header>
      {challenge && <div className="hm-chal"><span>{challenge.n} challenges you: beat <b>{challenge.p.toLocaleString()}</b></span><button onClick={() => onNav('friend')}>Open</button><button onClick={clearChallenge} aria-label="Dismiss">&times;</button></div>}
      <nav className="hm-nav" aria-label="Main menu">
        {NAV.map(([k, l, d], i) => <button key={k} className={`hm-btn ${k}`} style={{ animationDelay: `${.05 + i * .045}s` }} onClick={() => onNav(k)}><span>{l}</span><small>{d}</small>{k === 'career' && !daily.claimed && <u className="badge" title="Daily reward ready"><b>!</b></u>}</button>)}
      </nav>
      <div className="hm-dock" aria-label="More">{DOCK.map(([k, l]) => <button key={k} className={`hm-mini d-${k}`} onClick={() => onNav(k)}>{l}</button>)}</div>
      <div className="hm-play">
        <div className="hm-car"><button onClick={() => cycle(-1)} disabled={owned.length < 2} aria-label="Previous car">&#8249;</button><span><small>Your car</small>{v.name}</span><button onClick={() => cycle(1)} disabled={owned.length < 2} aria-label="Next car">&#8250;</button></div>
        <button className="hm-go" onClick={() => onNav('play')}><span>START</span><small>{raceLbl ? raceLbl : endless ? `Endless · ${endlessRoad(s.sel.road).name}` : `Drift run · ${dist.name}`}</small></button>
      </div>
    </div>
  );
}
