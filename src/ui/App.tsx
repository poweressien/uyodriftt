import { useEffect, useRef, useState } from 'react';
import type Phaser from 'phaser';
import { DISTRICTS } from '../game/data/districts';
import { rankFor } from '../game/data/progression';
import type { RunResult } from '../game/types';
import { music, unlockAudio } from '../game/systems/Audio';
import { requestTilt } from '../game/systems/Controls';

import { useSave, select, setSettings, finishRun, parseChallenge, makeChallengeLink, getSave, resetSave, Outcome } from '../state/store';
import { Skyline } from './Bits';
import { PopupHost, pushPopup } from './Popups';
import Garage from './Garage';
import Menu from './Menu';
import { Missions, Achievements, Ranks, Board, SettingsScreen } from './Screens';

type Screen = 'menu' | 'play' | 'results' | 'garage' | 'missions' | 'achievements' | 'ranks' | 'board' | 'settings';
const fonts = () => Promise.race([Promise.all(['40px Anton', '700 20px "Barlow Condensed"', '500 16px Barlow'].map(f => document.fonts.load(f))), new Promise(r => setTimeout(r, 1800))]);

export default function App() {
  const s = useSave(), [screen, setScreen] = useState<Screen>('menu'), [loading, setLoading] = useState(false);
  const [res, setRes] = useState<{ r: RunResult; o: Outcome } | null>(null), [challenge, setChallenge] = useState(() => parseChallenge(location.hash));
  const mount = useRef<HTMLDivElement>(null), rank = rankFor(s.xp), sel = s.sel;
  const dist = DISTRICTS.find(d => d.id === sel.district) ?? DISTRICTS[0];
  useEffect(() => { if (challenge && DISTRICTS.find(d => d.id === challenge.d)!.minRank <= rank) select({ district: challenge.d }); }, []); // eslint-disable-line
  useEffect(() => { if (dist.minRank > rank) select({ district: DISTRICTS[0].id }); if (!s.owned[sel.vehicle]) select({ vehicle: 'corolla' }); }, [rank, s.owned, dist.minRank, sel.vehicle]);

  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer:coarse)').matches;
  useEffect(() => { if (screen === 'play') return; music.start('menu'); return () => music.stop(true); }, [screen]);
  const drive = async () => { unlockAudio(); if (coarse && s.settings.controls === 'tilt' && !(await requestTilt())) setSettings({ controls: 'arrows' }); setScreen('play'); };
  useEffect(() => {
    if (screen !== 'play' || !mount.current) return; let game: Phaser.Game | undefined, dead = false; setLoading(true);
    Promise.all([import('../game/config'), fonts()]).then(([{ createGame }]) => {
      if (dead) return; const cur = getSave(), car = cur.owned[cur.sel.vehicle];
      game = createGame(mount.current!, { districtId: cur.sel.district, vehicleId: cur.sel.vehicle, car, mode: cur.sel.mode }); (window as any).__uyo = game; setLoading(false);
      game.events.on('quit', () => setScreen('menu'));
      game.events.on('bank', (r: RunResult) => { const o = finishRun(r, null); o.rankRewards.forEach(x => pushPopup({ kind: 'rank', title: `RANK UP: ${x.name}`, body: `+${x.coins.toLocaleString()} coins, +${x.parts} parts` })); o.achievements.forEach(x => pushPopup({ kind: 'achievement', title: x.name, body: `${x.description} · +${x.coins} coins` })); if (o.coins > 0) pushPopup({ kind: 'reward', title: `Run saved: ${r.points.toLocaleString()} pts`, body: `+${o.coins.toLocaleString()} coins · ${(r.distance ?? 0).toLocaleString()} m` }); });
      game.events.on('end', (r: RunResult) => {
        const o = finishRun(r, challenge);
        o.rankRewards.forEach(x => pushPopup({ kind: 'rank', title: `RANK UP: ${x.name}`, body: `+${x.coins.toLocaleString()} coins, +${x.parts} parts${x.unlocks.length ? ' · Unlocked: ' + x.unlocks.join(', ') : ''}` }));
        o.achievements.forEach(x => pushPopup({ kind: 'achievement', title: x.name, body: `${x.description} · +${x.coins} coins` }));
        if (o.challengeBeaten) pushPopup({ kind: 'reward', title: 'Challenge beaten!', body: '+500 coins' });
        setRes({ r, o }); setScreen('results');
      });
    });
    return () => { dead = true; game?.destroy(true); };
  }, [screen]); // eslint-disable-line

  const share = async () => {
    if (!res) return; const { url } = makeChallengeLink(res.r.districtId, res.r.points), text = `I scored ${res.r.points.toLocaleString()} on ${dist.name} in UYO DRIFT. Beat me!`;
    try { if (navigator.share) await navigator.share({ title: 'UYO DRIFT', text, url }); else { await navigator.clipboard.writeText(`${text} ${url}`); pushPopup({ kind: 'reward', title: 'Challenge link copied', body: 'Send it to a friend on WhatsApp' }); } } catch { /* cancelled */ }
  };

  if (screen === 'play') return <><PopupHost /><div ref={mount} style={{ position: 'absolute', inset: 0, background: '#031a0f' }} />{loading && <div className="loading">LOADING UYO...</div>}</>;
  const back = () => setScreen('menu'), d = res?.r;
  if (screen === 'menu') return <><PopupHost /><Menu s={s} onDrive={drive} onNav={setScreen} challenge={challenge} clearChallenge={() => { setChallenge(null); history.replaceState(null, '', location.pathname); }} /></>;
  return (
    <><PopupHost /><div className="bg" /><Skyline />
      {screen === 'results' && d && res && <div className="screen" style={{ justifyContent: 'center' }}>
        <div className="tag">{DISTRICTS.find(x => x.id === d.districtId)!.name} &middot; run complete</div>
        <div className="big-num">{d.points.toLocaleString()}</div>
        <div className="panel list" style={{ width: 'min(520px,100%)' }}>
          {([['Laps', d.laps], ['Drifts landed', d.drifts], ['Best combo', 'x' + d.maxCombo], ['Top speed', d.topSpeed + ' km/h'], ['Clean run bonus', d.clean ? '+' + d.cleanBonus : '—']] as const).map(([k, v]) => <div className="row cond" key={k}><span className="muted">{k}</span><b>{v}</b></div>)}
          <div className="row cond"><span className="muted">Earned</span><b className="gold">+{res.o.coins.toLocaleString()} coins · +{res.o.xp.toLocaleString()} XP</b></div>
          {res.o.achievements.map(a => <div key={a.id} className="row cond gold"><span>★ {a.name}</span><b>+{a.coins}</b></div>)}
          {res.o.rankRewards.map(r => <div key={r.rank} className="row cond grn"><span>▲ {r.name}</span><b>+{r.coins.toLocaleString()}</b></div>)}
        </div>
        <div className="chips"><button className="btn primary" onClick={() => setScreen('play')}>Retry</button><button className="btn" onClick={share}>Challenge a friend</button><button className="btn" onClick={back}>Menu</button></div>
      </div>}
      {screen === 'garage' && <Garage onBack={back} />}
      {screen === 'missions' && <Missions onBack={back} />}
      {screen === 'achievements' && <Achievements onBack={back} />}
      {screen === 'ranks' && <Ranks onBack={back} />}
      {screen === 'board' && <Board onBack={back} />}
      {screen === 'settings' && <SettingsScreen onBack={back} />}
    </>
  );
}
