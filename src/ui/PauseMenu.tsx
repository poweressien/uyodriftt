import { useSave, setSettings } from '../state/store';
import { VIEW_LABEL } from '../game/data/settings';
import { requestTilt } from '../game/systems/Controls';
import AudioPanel from './AudioPanel';
import { pushPopup } from './Popups';

/** Pause overlay above the game canvas. In a live race the game keeps running underneath. */
export default function PauseMenu({ onResume, onCam, onRestart, onQuit, live, touch }: { onResume: () => void; onCam: () => void; onRestart?: () => void; onQuit: () => void; live: boolean; touch: boolean }) {
  const s = useSave().settings;
  const steer = async () => { const next = s.controls === 'arrows' ? 'tilt' : 'arrows'; if (next === 'tilt' && !(await requestTilt())) { pushPopup({ kind: 'reward', title: 'Tilt is not available on this device' }); return; } setSettings({ controls: next }); };
  return (
    <div className="pause" role="dialog" aria-label="Paused">
      <div className="pause-card">
        <h2>{live ? 'MENU' : 'PAUSED'}</h2>
        {live && <div className="muted">Live race: the clock keeps running.</div>}
        <button className="btn primary" onClick={onResume}>Resume</button>
        <div className="pause-row"><button className="btn" onClick={onCam}>Camera: {VIEW_LABEL[s.view]}</button>{touch && <button className="btn" onClick={steer}>Steering: {s.controls === 'tilt' ? 'Tilt' : 'Arrows'}</button>}</div>
        <AudioPanel compact />
        <div className="pause-row">{onRestart && <button className="btn" onClick={onRestart}>Restart</button>}<button className="btn danger" onClick={onQuit}>{live ? 'Leave race' : 'Quit to menu'}</button></div>
      </div>
    </div>
  );
}
