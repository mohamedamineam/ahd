import { useEffect } from 'react';
import clsx from 'clsx';
import { useFmt } from '@/lib/useFmt';
import { api, type AdhanSound } from '@/lib/bridge';
import { usePrayer } from '@/features/prayer/store';
import { useSettings, useS } from '@/features/settings/store';
import type { AdhanMode } from '@/features/settings/schema';
import type { AdhanPrayerId } from '@/features/prayer/types';
import { useAudio } from '@/app/shell/AdhanPlayingPill';
import { IconButton, Select, Slider, Toggle } from '@/design/components';
import { IconPlay, IconStop } from '@/design/icons';
import { formatClock } from '@/lib/format';

export const ADHAN_MODES: AdhanMode[] = ['full', 'short', 'tone', 'silent', 'off'];

export function soundLabel(s: AdhanSound, lang: 'ar' | 'en') {
  return lang === 'ar' ? s.nameAr : s.nameEn;
}

export function useSounds() {
  const sounds = usePrayer((s) => s.sounds);
  const reload = usePrayer((s) => s.reloadSounds);
  useEffect(() => {
    if (!sounds.length) void reload();
  }, [sounds.length, reload]);
  return sounds;
}

export function PreviewButton({ sound, volume }: { sound: string; volume: number }) {
  const { t } = useFmt();
  const audio = useAudio();
  const playing = audio.playing && audio.kind === 'preview' && audio.sound === sound;
  return (
    <IconButton
      label={playing ? t('common.stop') : t('common.preview')}
      variant="soft"
      size="md"
      onClick={() => (playing ? void api.stopAdhan() : void api.playPreview(sound, volume))}
    >
      {playing ? <IconStop size={16} /> : <IconPlay size={16} />}
    </IconButton>
  );
}

export function SoundSelect({ value, onChange, fajr, label }: { value: string; onChange: (v: string) => void; fajr?: boolean; label: string }) {
  const { t, lang, digits } = useFmt();
  const sounds = useSounds();
  const sorted = [...sounds].sort((a, b) => Number(b.isFajr === !!fajr) - Number(a.isFajr === !!fajr));
  return (
    <Select
      label={label}
      value={value}
      onChange={onChange}
      className="w-full min-w-0 sm:w-80"
      options={sorted.map((s) => ({
        value: s.id,
        label: soundLabel(s, lang),
        hint: `${s.builtin ? t('settings.adhan.builtin') : t('settings.adhan.customLabel')} — ${formatClock(s.durationS, digits)}${s.isFajr ? ` — ${t('settings.adhan.fajrBadge')}` : ''}`,
        group: s.isFajr ? t('settings.adhan.fajrSound') : t('settings.adhan.sound'),
      }))}
    />
  );
}

/** Mode, sound, volume and fade for one prayer. */
export function PrayerAdhanControls({ prayer }: { prayer: AdhanPrayerId }) {
  const { t } = useFmt();
  const cfg = useS((s) => s.adhan.perPrayer[prayer]);
  const fajrSound = useS((s) => s.adhan.fajrSound);
  const update = useSettings((s) => s.update);
  const sound = prayer === 'fajr' ? fajrSound : cfg.sound;
  const audible = cfg.mode === 'full' || cfg.mode === 'short';

  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label={t('settings.adhan.mode')} className="grid grid-cols-1 gap-1.5">
        {ADHAN_MODES.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={cfg.mode === m}
            onClick={() => update((d) => void (d.adhan.perPrayer[prayer].mode = m))}
            className={clsx(
              'flex items-center gap-3 rounded-[10px] border px-3 py-2.5 text-start transition-colors',
              cfg.mode === m ? 'border-sage bg-sage-soft text-ink' : 'border-line-soft hover:border-line',
            )}
          >
            <span className={clsx('flex h-4 w-4 items-center justify-center rounded-full border', cfg.mode === m ? 'border-sage-strong' : 'border-line')}>
              {cfg.mode === m ? <span className="h-2 w-2 rounded-full bg-sage-strong" /> : null}
            </span>
            <span className="font-medium">{t(`settings.adhan.mode${m[0]!.toUpperCase()}${m.slice(1)}`)}</span>
          </button>
        ))}
      </div>

      {audible ? (
        <>
          <div className="flex flex-col gap-2">
            <span className="text-[0.875rem] font-medium text-ink">{prayer === 'fajr' ? t('settings.adhan.fajrSound') : t('settings.adhan.sound')}</span>
            <div className="flex items-center gap-2">
              <SoundSelect
                label={t('settings.adhan.sound')}
                value={sound}
                fajr={prayer === 'fajr'}
                onChange={(v) =>
                  update((d) => {
                    if (prayer === 'fajr') d.adhan.fajrSound = v;
                    d.adhan.perPrayer[prayer].sound = v;
                  })
                }
              />
              <PreviewButton sound={sound} volume={cfg.volume} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[0.875rem] font-medium text-ink">{t('settings.adhan.volume')}</span>
            <Slider
              label={t('settings.adhan.volume')}
              value={Math.round(cfg.volume * 100)}
              min={5}
              max={100}
              step={5}
              format={(v) => `${v}%`}
              onChange={(v) => update((d) => void (d.adhan.perPrayer[prayer].volume = v / 100))}
            />
          </div>
          <label className="flex items-center justify-between gap-3">
            <span className="font-medium text-ink">{t('settings.adhan.fadeIn')}</span>
            <Toggle checked={cfg.fadeIn} onChange={(v) => update((d) => void (d.adhan.perPrayer[prayer].fadeIn = v))} label={t('settings.adhan.fadeIn')} />
          </label>
        </>
      ) : null}
    </div>
  );
}
