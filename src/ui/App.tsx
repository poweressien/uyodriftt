import { useEffect, useRef, useState } from 'react';
import type Phaser from 'phaser';
import { DISTRICTS } from '../game/data/districts';
import { rankFor } from '../game/data/progression';
import type { RunResult, RunConfig } from '../game/types';
import { music, unlockAudio, uiSound } from '../game/systems/Audio';
import { requestTilt } from '../game/systems/Controls';
import { MpSession, parseInvite } from '../game/systems/Net';
import { useSave, select, setSettings, finishRun, parseChallenge, makeChallengeLink, getSave, logChallenge, playerName, Outcome } from '../state/store';

import { PopupHost, pushPopup } from './Popups';
import Garage from './Garage';
import Menu, { type Go } from './Menu';
import PlayScreen from './PlayScreen';
import PauseMenu from './PauseMenu';
import Career, { DailyCard } from './Career';
import Multiplayer, { myPlayer, type MpStart } from './Multiplayer';
import { Missions, Achievements, Ranks, Board, SettingsScreen } from './Screens';

type Screen = 'menu' | 'play' | 'running' | 'results' | 'garage' | 'missions' | 'achievements' | 'ranks' | 'board' | 'settings' | 'career' | 'multiplayer' | 'goodbye';
const fonts = () => Promise.race([Promise.all(['40px Anton', '700 20px "Barlow Condensed"', '500 16px Barlow'].map(f => document.fonts.load(f))), new Promise(r => setTimeout(r, 1800))]);
type Ch = { code: string; d: string; p: number; m: 'drift' | 'endless'; n: string };

export default function App() {
  const s = useSave(), [screen, setScreen] = useState<Screen>('menu'), [loading, setLoading] = useState(false), [paused, setPaused] = useState(false), [runKey, setRunKey] = useState(0), [confirmQuit, setConfirmQuit] = useState(false);
  const [res, setRes] = useState<{ r: RunResult; o: Outcome } | null>(null), [challenge, setChallenge] = useState<Ch | null>(() => { const c = parseChallenge(location.hash); if (c) logChallenge(c); return c; });
  const [invite, setInvite] = useState<string | null>(() => parseInvite(location.hash)), [session, setSession] = useState<MpSession | null>(null), [mpStart, setMpStart] = useState<MpStart | null>(null);
  const mount = useRef<HTMLDivElement>(null), gameRef = useRef<Phaser.Game | null>(null), liveAch = useRef<Set<string>>(new Set()), rank = rankFor(s.xp), sel = s.sel, sessionRef = useRef<MpSession | null>(null); sessionRef.current = session;
  const dist = DISTRICTS.find(d => d.id === sel.district) ?? DISTRICTS[0];
  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer:coarse)').matches;
  const go = (k: Screen) => { uiSound(k === 'menu' ? 'back' : 'tap'); setScreen(k); };

  // links: friend invite (#j=) opens the multiplayer screen; challenge (#c=) shows a banner
  useEffect(() => { if (invite) { history.replaceState(null, '', location.pathname); setScreen('multiplayer'); } }, []); // eslint-disable-line
  useEffect(() => { if (challenge) { const d = DISTRICTS.find(x => x.id === challenge.d); if (d && d.minRank <= rank) select({ district: challenge.d, mode: challenge.m }); history.replaceState(null, '', location.pathname); } }, []); // eslint-disable-line
  useEffect(() => { if (dist.minRank > rank) select({ district: DISTRICTS[0].id }); if (!s.owned[sel.vehicle]) select({ vehicle: 'corolla' }); }, [rank, s.owned, dist.minRank, sel.vehicle]);
  useEffect(() => { if (screen === 'running' || screen === 'goodbye') return; music.start('menu'); return () => music.stop(true); }, [screen]);
  useEffect(() => () => { sessionRef.current?.close(); }, []);

  const startRun = async (over?: { mp?: MpStart; challenge?: Ch }) => {
    unlockAudio(); if (coarse && getSave().settings.controls === 'tilt' && !(await requestTilt())) setSettings({ controls: 'arrows' });
    if (over?.challenge) { select({ district: over.challenge.d, mode: over.challenge.m }); setChallenge(over.challenge); }
    setMpStart(over?.mp ?? null); setPaused(false); liveAch.current = new Set(); setRunKey(k => k + 1); setScreen('running');
  };
  useEffect(() => {
    if (screen !== 'running' || !mount.current) return; let game: Phaser.Game | undefined, dead = false; setLoading(true);
    Promise.all([import('../game/config'), fonts()]).then(([{ createGame }]) => {
      if (dead) return; const cur = getSave(), mp = mpStart, live = mp && sessionRef.current && sessionRef.current.state === 'open' ? sessionRef.current : null;
      const cfg: RunConfig = { districtId: mp ? mp.d : cur.sel.district, vehicleId: cur.sel.vehicle, car: cur.owned[cur.sel.vehicle], mode: mp ? 'drift' : cur.sel.mode, road: cur.sel.road, weather: mp ? mp.w : cur.sel.weather === 'auto' ? undefined : cur.sel.weather, mp: live };
      game = createGame(mount.current!, cfg); gameRef.current = game; (window as any).__uyo = game; setLoading(false);
      game.events.on('quit', () => { setPaused(false); setScreen(sessionRef.current?.state === 'open' && mp ? 'multiplayer' : 'menu'); });
      game.events.on('paused', (p: boolean) => setPaused(p));
      game.events.on('achievement', (a: { id: string; name: string; description: string; coins: number }) => { liveAch.current.add(a.id); pushPopup({ kind: 'achievement', title: a.name, body: `${a.description} · +${a.coins} coins` }); });
      game.events.on('bank', (r: RunResult) => { const o = finishRun(r, null); o.rankRewards.forEach(x => pushPopup({ kind: 'rank', title: `RANK UP: ${x.name}`, body: `+${x.coins.toLocaleString()} coins, +${x.parts} parts` })); o.achievements.filter(a => !liveAch.current.has(a.id)).forEach(x => pushPopup({ kind: 'achievement', title: x.name, body: `${x.description} · +${x.coins} coins` })); o.events.forEach(e => pushPopup({ kind: 'achievement', title: `Event: ${e.name}`, body: `+${e.coins.toLocaleString()} coins` })); if (o.coins > 0) pushPopup({ kind: 'reward', title: `Run saved: ${r.points.toLocaleString()} pts`, body: `+${o.coins.toLocaleString()} coins · ${(r.distance ?? 0).toLocaleString()} m` }); });
      game.events.on('end', (r: RunResult) => {
        const o = finishRun(r, challenge && !mp ? challenge : null);
        o.rankRewards.forEach(x => pushPopup({ kind: 'rank', title: `RANK UP: ${x.name}`, body: `+${x.coins.toLocaleString()} coins, +${x.parts} parts${x.unlocks.length ? ' · Unlocked: ' + x.unlocks.join(', ') : ''}` }));
        o.achievements.filter(a => !liveAch.current.has(a.id)).forEach(x => pushPopup({ kind: 'achievement', title: x.name, body: `${x.description} · +${x.coins} coins` }));
        o.events.forEach(e => pushPopup({ kind: 'achievement', title: `Event: ${e.name}`, body: `+${e.coins.toLocaleString()} coins${e.parts ? `, +${e.parts} parts` : ''}` }));
        if (o.challengeBeaten) pushPopup({ kind: 'reward', title: 'Challenge beaten!', body: '+500 coins' });
        setPaused(false); setRes({ r, o }); setScreen('results');
      });
    });
    return () => { dead = true; gameRef.current = null; game?.destroy(true); };
  }, [screen === 'running' ? runKey : -1]); // eslint-disable-line

  const share = async () => {
    if (!res) return; const { url } = makeChallengeLink(res.r.districtId, res.r.points, res.r.mode ?? 'drift'), text = `${playerName(s)} scored ${res.r.points.toLocaleString()} on ${DISTRICTS.find(d => d.id === res.r.districtId)?.name} in UYO DRIFT. Beat me!`;
    try { if (navigator.share) await navigator.share({ title: 'UYO DRIFT', text, url }); else { await navigator.clipboard.writeText(`${text} ${url}`); pushPopup({ kind: 'reward', title: 'Challenge link copied', body: 'Send it to a friend on WhatsApp' }); } } catch { /* cancelled */ }
  };
  const nav = (k: Go) => { if (k === 'quit') { uiSound('tap'); setConfirmQuit(true); } else go(k as Screen); };
  const back = () => go('menu');
  const leaveRun = () => { gameRef.current?.events.emit('quit-req'); };

  // one soft tap sound for every button
  const tap = (e: React.MouseEvent) => { const el = (e.target as HTMLElement).closest('button'); if (el && !el.disabled && !el.classList.contains('quiet')) uiSound('tap'); };

  if (screen === 'running') return (
    <><PopupHost /><div ref={mount} style={{ position: 'absolute', inset: 0, background: '#04060c' }} />{loading && <div className="loading">LOADING UYO...</div>}
      {coarse && <div className="rotate">Turn your phone sideways to play</div>}
      {paused && <PauseMenu live={!!mpStart && !!session} touch={coarse} onResume={() => gameRef.current?.events.emit('pause-toggle')} onCam={() => gameRef.current?.events.emit('cam-next')} onRestart={mpStart ? undefined : () => { setPaused(false); gameRef.current?.events.emit('quit-req'); setTimeout(() => void startRun(), 60); }} onQuit={leaveRun} />}</>
  );
  if (screen === 'goodbye') return (
    <><div className="bg" /><div className="screen" style={{ justifyContent: 'center', textAlign: 'center' }}><h1 className="logo"><span>UYO</span><em>DRIFT</em></h1><div className="tag">Thanks for playing. E don do for today!</div>
      <div className="muted">Your progress is saved on this device. You can close this tab now.</div><div className="chips"><button className="btn primary" onClick={() => { go('menu'); }}>Back to game</button><button className="btn" onClick={() => { window.close(); }}>Close tab</button></div></div></>
  );
  const d = res?.r, mpRes = d?.mp;
  return (
    <div onClick={tap}><PopupHost />
      {screen === 'menu' ? <Menu s={s} onNav={nav} challenge={challenge} clearChallenge={() => setChallenge(null)} /> : <><div className="bg" />
        {screen === 'play' && <PlayScreen onBack={back} onStart={() => void startRun()} onGarage={() => go('garage')} />}
        {screen === 'results' && d && res && <div className="screen" style={{ justifyContent: 'center' }}>
          <div className="tag">{DISTRICTS.find(x => x.id === d.districtId)!.name} &middot; run complete</div>
          {mpRes && <div className={`mp-banner ${mpRes.won ? 'win' : mpRes.tie ? '' : 'lose'}`}>{mpRes.won ? 'YOU WIN!' : mpRes.tie ? 'IT IS A TIE' : `${mpRes.oppName.toUpperCase()} WINS`}<small>{mpRes.oppName}: {mpRes.oppScore.toLocaleString()}</small></div>}
          <div className="big-num">{d.points.toLocaleString()}</div>{res.o.newBest && <div className="gold cond">New personal best!</div>}
          <div className="panel list" style={{ width: 'min(520px,100%)' }}>
            {([['Laps', d.mode === 'endless' ? '—' : d.laps], ['Distance', `${(d.distanceM ?? 0).toLocaleString()} m`], ['Drifts landed', d.drifts], ['Best combo', 'x' + d.maxCombo], ['Top speed', d.topSpeed + ' km/h'], ['Near misses', d.nearMisses ?? 0], ['Coins picked up', `+${((d.pickups ?? 0) * 10).toLocaleString()}`], ['Clean run bonus', d.clean ? '+' + d.cleanBonus : '—']] as const).map(([k, v]) => <div className="row cond" key={k}><span className="muted">{k}</span><b>{v}</b></div>)}
            <div className="row cond"><span className="muted">Earned</span><b className="gold">+{res.o.coins.toLocaleString()} coins · +{res.o.xp.toLocaleString()} XP</b></div>
            {res.o.events.map(e => <div key={e.id} className="row cond gold"><span>◆ Event: {e.name}</span><b>+{e.coins.toLocaleString()}</b></div>)}
            {res.o.achievements.map(a => <div key={a.id} className="row cond gold"><span>★ {a.name}</span><b>+{a.coins}</b></div>)}
            {res.o.rankRewards.map(r => <div key={r.rank} className="row cond grn"><span>▲ {r.name}</span><b>+{r.coins.toLocaleString()}</b></div>)}
          </div>
          <div className="chips">{mpRes && session?.state === 'open' ? <button className="btn primary" onClick={() => go('multiplayer')}>Rematch lobby</button> : <button className="btn primary" onClick={() => void startRun()}>Retry</button>}
            <button className="btn" onClick={share}>Challenge a friend</button><button className="btn" onClick={() => go('garage')}>Garage</button><button className="btn" onClick={back}>Menu</button></div>
        </div>}
        {screen === 'garage' && <Garage onBack={back} />}
        {screen === 'missions' && <Missions onBack={back} />}
        {screen === 'achievements' && <Achievements onBack={back} />}
        {screen === 'ranks' && <Ranks onBack={back} />}
        {screen === 'board' && <Board onBack={back} />}
        {screen === 'settings' && <SettingsScreen onBack={back} />}
        {screen === 'career' && <Career onBack={back} onPlay={() => go('play')} />}
        {screen === 'multiplayer' && <Multiplayer onBack={back} session={session} setSession={setSession} invite={invite} clearInvite={() => setInvite(null)} onStart={m => void startRun({ mp: m })} onChallenge={c => void startRun({ challenge: c })} />}
      </>}
      {confirmQuit && <div className="pause"><div className="pause-card"><h2>QUIT GAME?</h2><div className="muted">Your progress is already saved.</div><div className="pause-row"><button className="btn" onClick={() => setConfirmQuit(false)}>Stay</button><button className="btn danger" onClick={() => { setConfirmQuit(false); session?.close(); setScreen('goodbye'); }}>Quit</button></div></div></div>}
    </div>
  );
}
