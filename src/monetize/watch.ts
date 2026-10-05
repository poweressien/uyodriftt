import { showRewarded, adsAvailable } from './ads';
import { noteAd } from '../state/store';
import { pushPopup } from '../ui/Popups';
import { uiSound } from '../game/systems/Audio';

/** Plays a rewarded ad and says true ONLY if the player really earned the reward. Tells the player what happened when they did not. */
export async function watchAd(placement: string): Promise<boolean> {
  if (!adsAvailable()) { uiSound('error'); pushPopup({ kind: 'reward', title: 'Ads are not available in this build' }); return false; }
  const r = await showRewarded(placement);
  if (r === 'rewarded') { noteAd(); return true; }
  uiSound('error');
  pushPopup({ kind: 'reward', title: r === 'dismissed' ? 'Ad closed early: no reward' : 'No ad available right now', body: r === 'dismissed' ? 'Watch it to the end to get the reward' : 'Try again in a minute' });
  return false;
}
