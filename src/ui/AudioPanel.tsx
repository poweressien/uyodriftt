import { useSave, setSettings } from '../state/store';
import { uiSound } from '../game/systems/Audio';
import { speak } from '../game/systems/Radio';
import type { Settings } from '../game/data/settings';

type Ch = 'music' | 'engine' | 'radio' | 'sfx';
const CH: { k: Ch; label: string; hint: string }[] = [
  { k: 'engine', label: 'Car sound', hint: 'Engine hum. Off by default' },
  { k: 'radio', label: 'IBOM radio', hint: 'The pidgin voice on the radio' },
  { k: 'music', label: 'Music', hint: 'Background beats' },
  { k: 'sfx', label: 'Other sounds', hint: 'Crashes, horn, coins, menus' },
];
/** Four independent volume sliders. Each has its own mute button; moving a slider previews that channel. */
export default function AudioPanel({ compact }: { compact?: boolean }) {
  const s = useSave().settings;
  const set = (k: Ch, v: number) => setSettings({ [k]: v } as Partial<Settings>);
  const preview = (k: Ch) => { if (k === 'sfx') uiSound('buy'); else if (k === 'radio') speak('Ibom FM dey with you!', s.radio); };
  return (
    <div className={`aud${compact ? ' compact' : ''}`}>
      {CH.map(c => { const v = s[c.k], off = v <= 0; return (
        <div className="aud-row" key={c.k}>
          <div className="aud-name"><b>{c.label}</b>{!compact && <small>{c.hint}</small>}</div>
          <input type="range" min={0} max={100} step={5} value={Math.round(v * 100)} aria-label={c.label} onChange={e => set(c.k, +e.target.value / 100)} onPointerUp={() => preview(c.k)} style={{ ['--p' as any]: `${v * 100}%` }} />
          <span className="aud-val">{Math.round(v * 100)}</span>
          <button className={`chip sm${off ? ' on' : ''}`} onClick={() => set(c.k, off ? (c.k === 'music' ? .6 : .7) : 0)}>{off ? 'Off' : 'On'}</button>
        </div>); })}
      <label className="aud-cap"><input type="checkbox" checked={s.radioText} onChange={e => setSettings({ radioText: e.target.checked })} /> Show IBOM radio captions on screen</label>
    </div>
  );
}
