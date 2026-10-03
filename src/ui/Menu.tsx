import { VEHICLES } from '../game/data/vehicles';
import { RANKS, rankFor } from '../game/data/progression';
import { select, dailyStatus, type Save } from '../state/store';
import PlazaScene from './PlazaScene';

export type Go = 'play' | 'garage' | 'multiplayer' | 'career' | 'missions' | 'achievements' | 'ranks' | 'board' | 'settings' | 'quit';
const NAV: [Go, string, string][] = [
  ['play', 'Play', 'Drift run or endless drive'], ['garage', 'Garage', 'Buy, upgrade, paint'], ['multiplayer', 'Multiplayer', 'Race and challenge friends'], ['career', 'Career', 'Events and daily reward'], ['missions', 'Missions', 'Daily and weekly'],
  ['achievements', 'Achievements', 'Trophies'], ['board', 'Leaderboard', 'Your best runs'], ['ranks', 'Ranks', 'XP and unlocks'], ['settings', 'Settings', 'Sound, controls'], ['quit', 'Quit', 'Leave the game'],
];

/** Home screen: the Ibom Plaza roundabout and a number-plate logo. Everything else lives on its own screen. */
export default function Menu({ s, onNav, challenge, clearChallenge }: { s: Save; onNav: (k: Go) => void; challenge: { d: string; p: number; n: string } | null; clearChallenge: () => void }) {
  const rank = rankFor(s.xp), owned = VEHICLES.filter(v => s.owned[v.id]), vi = Math.max(0, owned.findIndex(v => v.id === s.sel.vehicle)), v = owned[vi] ?? VEHICLES[0];
  const next = RANKS[rank + 1], pct = next ? (s.xp - RANKS[rank].xp) / (next.xp - RANKS[rank].xp) : 1, daily = dailyStatus(s);
  return (
    <div className="hm">
      <PlazaScene />
      <header className="hm-top">
        <div className="hm-plate" aria-label="Uyo Drift"><i className="rv l" /><i className="rv r" /><div className="band">AKWA IBOM &middot; LAND OF PROMISE</div><div className="name">UYO&nbsp;DRIFT</div></div>
        <div className="hm-me">
          <div className="hm-chip"><b>{rank + 1}</b><span>{RANKS[rank].name}<em><i style={{ width: `${pct * 100}%` }} /></em></span></div>
          <div className="hm-chip coins"><i className="coin" />{s.coins.toLocaleString()}</div>
        </div>
      </header>
      {challenge && <div className="hm-chal"><span>{challenge.n} challenges you: beat <b>{challenge.p.toLocaleString()}</b></span><button onClick={() => onNav('multiplayer')}>Open</button><button onClick={clearChallenge} aria-label="Dismiss">&times;</button></div>}
      <nav className="hm-nav" aria-label="Main menu">
        {NAV.map(([k, l, d]) => <button key={k} className={`hm-btn ${k}`} onClick={() => onNav(k)}><span>{l}</span><small>{d}</small>{k === 'career' && !daily.claimed && <u className="badge" title="Daily reward ready">!</u>}</button>)}
      </nav>
      <div className="hm-car"><button onClick={() => select({ vehicle: owned[(vi - 1 + owned.length) % owned.length].id })} disabled={owned.length < 2} aria-label="Previous car">&#8249;</button><span><small>Your car</small>{v.name}</span><button onClick={() => select({ vehicle: owned[(vi + 1) % owned.length].id })} disabled={owned.length < 2} aria-label="Next car">&#8250;</button></div>
    </div>
  );
}
