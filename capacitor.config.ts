import type { CapacitorConfig } from '@capacitor/cli';
/** Native wrapper for Uyo Drift. The web build in dist/ is bundled into the app and served from https://localhost inside the WebView. */
const config: CapacitorConfig = {
  appId: 'ng.uyodrift.game',
  appName: 'Uyo Drift',
  webDir: 'dist',
  backgroundColor: '#05070d',
  android: { allowMixedContent: false, backgroundColor: '#05070d' },
  server: { androidScheme: 'https' },
  plugins: { StatusBar: { overlaysWebView: true, style: 'DARK' } },
};
export default config;
