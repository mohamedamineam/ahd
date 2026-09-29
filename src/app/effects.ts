/**
 * Main-window side effects: keep Rust in sync with settings that concern native windows, the tray,
 * autostart and the stop-adhan shortcut; react to tray menu actions.
 */
import { api, listen } from '@/lib/bridge';
import { useSettings } from '@/features/settings/store';
import type { Settings } from '@/features/settings/schema';
import { resolvedTheme } from './appearance';

function windowsConfig(s: Settings) {
  return {
    lang: s.general.language,
    theme: resolvedTheme(s),
    keepInTray: s.general.keepInTray,
    startWithSystem: s.general.startWithSystem,
    mainWidget: { ...s.widgets.main },
    miniWidget: { ...s.widgets.mini, size: 'M', pinDesktopLayer: false },
    indicator: { ...s.widgets.indicator },
    toastPosition: s.adhan.toastPosition,
    muteFullscreen: s.adhan.muteWhenFullscreen,
    respectDnd: s.adhan.respectDnd,
    stopShortcut: s.adhan.stopShortcut,
  };
}

let last = '';
let timer: ReturnType<typeof setTimeout> | null = null;

function push() {
  const s = useSettings.getState().s;
  if (!s.onboarding.done) return;
  const cfg = windowsConfig(s);
  const key = JSON.stringify(cfg);
  if (key === last) return;
  last = key;
  void api.applyWindows(cfg).catch(() => {});
}

export function startEffects() {
  push();
  useSettings.subscribe(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(push, 200);
  });
  void listen<{ action: string }>('ahd://tray-action', ({ action }) => {
    const update = useSettings.getState().update;
    if (action === 'toggle-widget') update((d) => void (d.widgets.main.enabled = !d.widgets.main.enabled));
    if (action === 'toggle-mini') update((d) => void (d.widgets.mini.enabled = !d.widgets.mini.enabled));
  });
}
