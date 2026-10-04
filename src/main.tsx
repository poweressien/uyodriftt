import { createRoot } from 'react-dom/client';
import '@fontsource/orbitron/700.css';
import '@fontsource/orbitron/900.css';
import '@fontsource/saira-condensed/700.css';
import '@fontsource/saira-condensed/800.css';
import '@fontsource/saira/500.css';
import '@fontsource/saira/600.css';
import './ui/game.css';
import App from './ui/App';
/** Canvas (Phaser) text does not trigger font loading by itself, so load the faces first, then draw. Never blocks for more than 1.5 s. */
const faces = ['900 20px Orbitron', '700 20px Orbitron', '700 20px "Saira Condensed"', '800 20px "Saira Condensed"', '500 16px Saira', '600 16px Saira'];
const ready = Promise.race([Promise.all(faces.map(f => document.fonts.load(f))), new Promise(r => setTimeout(r, 1500))]);
void ready.finally(() => createRoot(document.getElementById('root')!).render(<App />));
