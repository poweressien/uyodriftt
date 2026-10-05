import { useState } from 'react';
import { DISTRICTS, ROAD_TYPES, ENDLESS_ROADS, WEATHER_FX, type RoadType } from '../game/data/districts';
import { VEHICLES, BODY } from '../game/data/vehicles';
import { RANKS, rankFor, EVENTS } from '../game/data/progression';
import { WEATHER_PICKS, isRace, type Mode, type WeatherPick } from '../game/data/settings';
import { RACE_MODES, ROUTES, routeById } from '../game/data/races';
import { useSave, select } from '../state/store';
import { Header, Coins, MiniMap } from './Bits';
import { GasMeter } from './Gas';

const WLABEL: Record<WeatherPick, string> = { auto: 'Auto', sunny: 'Sunny', cloudy: 'Cloudy', rain: 'Rain', night: 'Night' };
/** Step by step: mode, road type, place, weather, car, then go. */
export default function PlayScreen({ onBack, onStart, onGarage }: { onBack: () => void; onStart: () => void; onGarage: () => void }) {
  const s = useSave(), rank = rankFor(s.xp), sel = s.sel, endless = sel.mode === 'endless' || sel.mode === 'elim' || sel.mode === 'demo', journey = sel.mode === 'journey', race = isRace(sel.mode), dist = DISTRICTS.find(d => d.id === sel.district) ?? DISTRICTS[0], v = VEHICLES.find(x => x.id === sel.vehicle) ?? VEHICLES[0];
  const [rt, setRt] = useState<RoadType>(dist.road), list = DISTRICTS.filter(d => d.road === rt), er = ENDLESS_ROADS.find(r => r.id === sel.road) ?? ENDLESS_ROADS[0];
  const evs = EVENTS.filter(e => e.district === dist.id && e.mode === sel.mode && !s.events.includes(e.id) && e.minRank <= rank);
  const pickRoadType = (id: RoadType) => { setRt(id); const first = DISTRICTS.find(d => d.road === id && d.minRank <= rank); if (first && !DISTRICTS.find(d => d.id === sel.district && d.road === id)) select({ district: first.id }); };
  const locked = (r: number) => r > rank;
  return (
    <div className="screen"><Header title={race ? 'CHALLENGE' : endless ? 'ENDLESS' : 'CLASSIC'} onBack={onBack} right={<><GasMeter s={s} compact /> <Coins s={s} /></>} />
      {race && <><div className="step"><span className="stepno">1</span><b>Challenge type</b></div>
      <div className="cards three">
        {RACE_MODES.map(r => <button key={r.id} className={`card${sel.mode === r.id ? ' on' : ''}`} onClick={() => select({ mode: r.id })}><h3>{r.name}</h3><small className="gold">{r.tag}</small><p>{r.blurb}</p></button>)}
      </div></>}
      <div className="step"><span className="stepno">{race ? 2 : 1}</span><b>{journey ? 'Route' : endless ? 'Road type' : 'Road type & place'}</b></div>
      {journey ? <div className="cards three">{ROUTES.map(r => <button key={r.id} className={`card${sel.route === r.id ? ' on' : ''}${locked(r.minRank) ? ' lock' : ''}`} disabled={locked(r.minRank)} onClick={() => select({ route: r.id })}><h3>{r.from} &rarr; {r.to}</h3><p>{(r.meters / 1000).toFixed(1)} km race. {r.legs[1]}.</p>{locked(r.minRank) && <small className="gold">Unlocks at {RANKS[r.minRank].name}</small>}</button>)}</div> : endless ? <>
        <div className="cards three">{ENDLESS_ROADS.map(r => <button key={r.id} className={`card${sel.road === r.id ? ' on' : ''}${locked(r.minRank) ? ' lock' : ''}`} disabled={locked(r.minRank)} onClick={() => select({ road: r.id })}>
          <h3>{r.name}</h3><p>{r.blurb}</p><div className="lanes">{Array.from({ length: r.lanes }, (_, i) => <i key={i} />)}</div>{locked(r.minRank) && <small className="gold">Unlocks at {RANKS[r.minRank].name}</small>}</button>)}</div>
        <div className="muted">Scenery</div>
        <div className="chips">{DISTRICTS.filter(d => d.id !== 'night-circuit').map(d => <button key={d.id} className={`chip${sel.district === d.id ? ' on' : ''}`} disabled={locked(d.minRank)} onClick={() => select({ district: d.id })}>{d.name}{locked(d.minRank) ? ' 🔒' : ''}</button>)}</div>
      </> : <>
        <div className="chips">{ROAD_TYPES.map(t => <button key={t.id} className={`chip${rt === t.id ? ' on' : ''}`} onClick={() => pickRoadType(t.id)}>{t.name}</button>)}</div>
        <div className="muted">{ROAD_TYPES.find(t => t.id === rt)?.blurb}</div>
        <div className="cards three">{list.map(d => <button key={d.id} className={`card${sel.district === d.id ? ' on' : ''}${locked(d.minRank) ? ' lock' : ''}`} disabled={locked(d.minRank)} onClick={() => select({ district: d.id })}>
          <MiniMap id={d.id} /><h3>{d.name.replace('Championship ', '')}</h3><p>{d.blurb}</p>
          <div className="pips2">{Array.from({ length: 8 }, (_, i) => <i key={i} className={i < d.difficulty ? 'on' : ''} />)}</div>{locked(d.minRank) && <small className="gold">Unlocks at {RANKS[d.minRank].name}</small>}</button>)}</div>
      </>}
      <div className="step"><span className="stepno">{race ? 3 : 2}</span><b>Weather</b></div>
      <div className="chips">{WEATHER_PICKS.map(w => <button key={w} className={`chip${sel.weather === w ? ' on' : ''}`} onClick={() => select({ weather: w })}>{WLABEL[w]}</button>)}</div>
      <div className="step"><span className="stepno">{race ? 4 : 3}</span><b>Your car</b></div>
      <div className="panel row"><div><b className="cond">{v.name}</b><div className="muted">{BODY[v.kind].label} &middot; top speed {v.topSpeed}/10 &middot; handling {v.handling}/10</div></div><button className="btn sm" onClick={onGarage}>Change car</button></div>
      {evs.length > 0 && <div className="panel"><div className="cond gold">Career events here</div>{evs.map(e => <div key={e.id} className="row cond"><span>{e.name}: <span className="muted">{e.description}</span></span><b className="gold">+{e.coins.toLocaleString()}</b></div>)}</div>}
      <div className="go-bar"><div><b className="cond">{journey ? `${routeById(sel.route).from} to ${routeById(sel.route).to}` : endless ? `${er.name} · ${dist.name}` : dist.name}</b><div className="muted">{sel.weather === 'auto' ? 'Weather: auto' : `Weather: ${WEATHER_FX[sel.weather].label}`} &middot; {race ? '1 gas · rivals, damage, prizes' : endless ? (s.stats.endless_best_m ? `Best ${s.stats.endless_best_m.toLocaleString()} m` : 'Five hits and it is over') : s.best[dist.id] ? `Best ${s.best[dist.id].toLocaleString()}` : '90 seconds'}</div></div><button className="btn primary big" onClick={onStart}>DRIVE</button></div>
    </div>
  );
}
