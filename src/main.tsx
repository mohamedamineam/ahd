import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import './design/globals.css';
import './design/fonts';
import { initI18n } from './i18n';
import { loadSettings, useSettings } from './features/settings/store';
import { applyAppearance, onSystemThemeChange } from './app/appearance';
import { windowKind } from './lib/bridge';
import { startClock } from './lib/clock';
import { hijriSelfTest } from './features/prayer/hijri';

const MainApp = lazy(() => import('./app/App'));
const WidgetWindow = lazy(() => import('./windows/widget/Widget'));
const PanelWindow = lazy(() => import('./windows/panel/TrayPanel'));
const PillWindow = lazy(() => import('./windows/pill/TaskbarPill'));
const ToastWindow = lazy(() => import('./windows/toast/AdhanToast'));

async function boot() {
  const kind = windowKind();
  document.documentElement.dataset.window = kind;
  const s = await loadSettings();
  initI18n(s.general.language, s.general.digits);
  applyAppearance(s);
  hijriSelfTest();
  useSettings.subscribe((st) => applyAppearance(st.s));
  onSystemThemeChange(() => applyAppearance(useSettings.getState().s));
  startClock();

  const View =
    kind === 'widget' ? WidgetWindow : kind === 'panel' ? PanelWindow : kind === 'pill' ? PillWindow : kind === 'toast' ? ToastWindow : MainApp;

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Suspense fallback={null}>
        <View />
      </Suspense>
    </StrictMode>,
  );
}

void boot();
