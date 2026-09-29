import clsx from 'clsx';
import { useFmt } from '@/lib/useFmt';
import { useS } from '@/features/settings/store';
import { contrastReport, paletteSwatch, paletteTokens, PALETTE_IDS, type PaletteId } from '@/design/palette';
import { resolvedTheme } from '@/app/appearance';
import { useSettings } from '@/features/settings/store';
import { Segmented, Slider, SwatchPicker, Toggle } from '@/design/components';
import { IconCheck, IconAlert } from '@/design/icons';
import { ThemePreview } from '../../onboarding/ThemePreview';
import { Group, ResetSection, Row, useUpdate } from './shared';

export default function Appearance() {
  const { t } = useFmt();
  const a = useS((s) => s.appearance);
  const settings = useSettings((s) => s.s);
  const update = useUpdate();
  const mode = resolvedTheme(settings);
  const report = contrastReport(paletteTokens(a.palette, mode, a.custom));
  return (
    <>
      <Group>
        <Row k="settings.appearance.theme" stacked>
          <div role="radiogroup" aria-label={t('settings.appearance.theme')} className="grid grid-cols-3 gap-3">
            {(['light', 'dark', 'system'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={a.theme === m}
                onClick={() => update((d) => void (d.appearance.theme = m))}
                className={clsx('flex flex-col gap-2 rounded-[14px] border-2 p-2 transition-colors', a.theme === m ? 'border-sage-strong' : 'border-line-soft hover:border-line')}
              >
                <ThemePreview mode={m} />
                <span className="pb-1 text-[0.875rem] font-medium text-ink">{m === 'system' ? t('common.system') : t(`common.${m}`)}</span>
              </button>
            ))}
          </div>
        </Row>
        <Row k="settings.appearance.palette" stacked>
          <SwatchPicker<PaletteId>
            label={t('settings.appearance.palette')}
            value={a.palette}
            onChange={(v) => update((d) => void (d.appearance.palette = v))}
            swatches={PALETTE_IDS.map((id) => ({ value: id, label: t(`settings.appearance.paletteNames.${id}`), colors: paletteSwatch(id, mode, a.custom) }))}
          />
          {a.palette === 'custom' ? (
            <div className="mt-4 grid gap-3 rounded-[12px] bg-surface-sunk p-4">
              <label className="grid grid-cols-[8rem_1fr] items-center gap-3 text-[0.875rem] text-ink">
                {t('settings.appearance.primaryHue')}
                <Slider label={t('settings.appearance.primaryHue')} value={a.custom.primaryHue} min={0} max={359} format={(v) => `${v}°`} onChange={(v) => update((d) => void (d.appearance.custom.primaryHue = v))} />
              </label>
              <label className="grid grid-cols-[8rem_1fr] items-center gap-3 text-[0.875rem] text-ink">
                {t('settings.appearance.accentHue')}
                <Slider label={t('settings.appearance.accentHue')} value={a.custom.accentHue} min={0} max={359} format={(v) => `${v}°`} onChange={(v) => update((d) => void (d.appearance.custom.accentHue = v))} />
              </label>
              <label className="grid grid-cols-[8rem_1fr] items-center gap-3 text-[0.875rem] text-ink">
                {t('settings.appearance.intensity')}
                <Slider
                  label={t('settings.appearance.intensity')}
                  value={Math.round((a.custom.chromaScale ?? 1) * 100)}
                  min={20}
                  max={130}
                  step={5}
                  format={(v) => `${v}%`}
                  onChange={(v) => update((d) => void (d.appearance.custom.chromaScale = v / 100))}
                />
              </label>
              <p className={clsx('flex items-center gap-2 text-[0.875rem]', report.ok ? 'text-sage-strong' : 'text-ochre-strong')}>
                {report.ok ? <IconCheck size={16} /> : <IconAlert size={16} />}
                {report.ok ? t('settings.appearance.contrastOk') : t('settings.appearance.contrastLow')}
              </p>
            </div>
          ) : null}
        </Row>
      </Group>
      <Group>
        <Row k="settings.appearance.uiScale" stacked>
          <Slider
            label={t('settings.appearance.uiScale')}
            value={Math.round(a.uiScale * 100)}
            min={90}
            max={150}
            step={5}
            format={(v) => `${v}%`}
            onChange={(v) => update((d) => void (d.appearance.uiScale = v / 100))}
            className="max-w-md"
          />
        </Row>
        <Row k="settings.appearance.reduceMotion">
          <Toggle checked={a.reduceMotion} onChange={(v) => update((d) => void (d.appearance.reduceMotion = v))} label={t('settings.appearance.reduceMotion')} />
        </Row>
        <Row k="settings.appearance.pattern">
          <Toggle checked={a.pattern} onChange={(v) => update((d) => void (d.appearance.pattern = v))} label={t('settings.appearance.pattern')} />
        </Row>
        <Row k="settings.appearance.quranPaper">
          <Segmented
            size="sm"
            label={t('settings.appearance.quranPaper')}
            value={a.quranPaper}
            onChange={(v) => update((d) => void (d.appearance.quranPaper = v))}
            options={[
              { value: 'auto', label: t('common.auto') },
              { value: 'parchment', label: t('settings.quran.parchment') },
              { value: 'sepia', label: t('settings.quran.sepia') },
              { value: 'dark', label: t('common.dark') },
            ]}
          />
        </Row>
      </Group>
      <ResetSection keys={['appearance']} />
    </>
  );
}
