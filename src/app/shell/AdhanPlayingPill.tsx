import { create } from 'zustand';
import { useTranslation } from 'react-i18next';
import { api, EV, listen, type AudioState } from '@/lib/bridge';
import { IconStop } from '@/design/icons';

export const useAudio = create<AudioState>(() => ({
  playing: false,
  kind: null,
  prayer: null,
  sound: null,
  startedAt: null,
  duration: null,
}));

let started = false;
export function startAudioState() {
  if (started) return;
  started = true;
  void api.audioState().then((s) => s && useAudio.setState(s)).catch(() => {});
  void listen<AudioState>(EV.audio, (s) => useAudio.setState(s));
}

function Bars() {
  return (
    <span className="flex h-4 items-end gap-[3px]" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-current"
          style={{ height: '100%', animation: `sakan-bars 1s ${i * 0.15}s ease-in-out infinite alternate`, transformOrigin: 'bottom' }}
        />
      ))}
    </span>
  );
}

/** Floating "Stop adhan" pill in the main window while the adhan plays (brief §10.2). */
export function AdhanPlayingPill() {
  const { t } = useTranslation();
  const a = useAudio();
  if (!a.playing || a.kind === 'tone') return null;
  const label = a.kind === 'adhan' && a.prayer ? `${t(`prayers.${a.prayer}`)} — ${t('home.adhanPlaying')}` : t('home.adhanPlaying');
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center">
      <div className="animate-scale-in pointer-events-auto flex items-center gap-4 rounded-full border border-line-soft bg-surface-raised py-2 ps-5 pe-2 shadow-lg">
        <span className="flex items-center gap-3 text-sage-strong">
          <Bars />
          <span className="font-medium text-ink">{label}</span>
        </span>
        <button
          type="button"
          onClick={() => void api.stopAdhan()}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-sage-strong px-4 font-medium text-on-sage transition-transform active:scale-95"
        >
          <IconStop size={16} />
          {t('home.stopAdhan')}
        </button>
      </div>
    </div>
  );
}
