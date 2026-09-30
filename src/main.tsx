import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import './design/globals.css';
import './design/fonts';
import { initI18n } from './i18n';
import { loadSettings, useSettings } from './features/settings/store';
import { applyAppearance, onSystemThemeChange } from './app/appearance';
import { IS_TAURI, windowKind } from './lib/bridge';
import { startClock } from './lib/clock';
import { hijriSelfTest } from './features/prayer/hijri';

const MainApp = lazy(() => import('./app/App'));
const WidgetWindow = lazy(() => import('./windows/widget/Widget'));
const MiniWindow = lazy(() => import('./windows/mini/MiniWidget'));
const PillWindow = lazy(() => import('./windows/pill/TaskbarPill'));
const ToastWindow = lazy(() => import('./windows/toast/AdhanToast'));

/** Frontend errors go to the app's log file too (Settings → About → Open logs folder), for bug reports. */
function forwardErrors(kind: string) {
  if (!IS_TAURI) return;
  const send = (msg: string) =>
    void import('@tauri-apps/plugin-log').then(({ error }) => error(`[${kind}] ${msg}`)).catch(() => {});
  window.addEventListener('error', (e) => send(`${e.message} at ${e.filename}:${e.lineno}:${e.colno}`));
  window.addEventListener('unhandledrejection', (e) => send(`unhandled rejection: ${e.reason instanceof Error ? (e.reason.stack ?? e.reason.message) : String(e.reason)}`));
}

async function boot() {
  const kind = windowKind();
  forwardErrors(kind);
  document.documentElement.dataset.window = kind;
  const s = await loadSettings();
  initI18n(s.general.language, s.general.digits);
  applyAppearance(s, document.documentElement, kind);
  hijriSelfTest();
  useSettings.subscribe((st) => applyAppearance(st.s, document.documentElement, kind));
  onSystemThemeChange(() => applyAppearance(useSettings.getState().s, document.documentElement, kind));
  startClock();

  const View =
    kind === 'widget' ? WidgetWindow : kind === 'mini' ? MiniWindow : kind === 'pill' ? PillWindow : kind === 'toast' ? ToastWindow : MainApp;

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Suspense fallback={null}>
        <View />
      </Suspense>
    </StrictMode>,
  );
}

void boot();
