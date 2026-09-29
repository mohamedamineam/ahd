import { useState } from 'react';
import { DateTime } from 'luxon';
import { useFmt } from '@/lib/useFmt';
import { useS } from '@/features/settings/store';
import { usePrayer } from '@/features/prayer/store';
import { METHODS, METHOD_IDS, type MethodId } from '@/features/prayer/methods';
import { addDays, localDate } from '@/features/prayer/engine';
import { PRAYER_IDS, type HighLatitudeRuleId } from '@/features/prayer/types';
import { parseTimetable, templateCsv, type ImportError } from '@/features/prayer/timetableImport';
import { openTextFile, saveTextFile } from '@/lib/files';
import { formatTime } from '@/lib/format';
import { Button, NumberField, Segmented, Select, Stepper, Toggle, toast } from '@/design/components';
import { IconDownload, IconTrash, IconUpload } from '@/design/icons';
import { TimesTuner } from '../../onboarding/TimesTuner';
import { Group, ResetSection, Row, useUpdate } from './shared';

export default function Calculation() {
  const f = useFmt();
  const { t } = f;
  const calc = useS((s) => s.calc);
  const update = useUpdate();
  const engine = usePrayer((s) => s.engine);
  const official = usePrayer((s) => s.official);
  const setOfficial = usePrayer((s) => s.setOfficial);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const method = METHODS[calc.method as MethodId] ?? METHODS.mwl;
  const custom = calc.method === 'custom' || calc.fajrAngle !== null || calc.ishaAngle !== null || calc.ishaInterval !== null || calc.maghribAngle !== null;
  const officialDays = Object.keys(official).length;

  const importTimetable = async () => {
    const file = await openTextFile(['csv', 'json', 'txt']);
    if (!file) return;
    const r = parseTimetable(file.text, file.name);
    setErrors(r.errors);
    if (!r.errors.length) {
      await setOfficial(r.table);
      update((d) => void (d.calc.useOfficialTimetable = true));
      toast(t('settings.calc.officialRows', { count: Object.keys(r.table).length }), 'success');
    }
  };

  const downloadTemplate = async () => {
    if (!engine) return;
    const today = localDate(Date.now(), engine.zone);
    const rows = [0, 1, 2].map((i) => {
      const date = addDays(today, i);
      const day = engine.day(date);
      return {
        date,
        times: Object.fromEntries(PRAYER_IDS.map((p) => [p, formatTime(day.times[p], engine.zone, { lang: 'en', digits: 'latn', format: '24h' })])) as Record<
          (typeof PRAYER_IDS)[number],
          string
        >,
      };
    });
    await saveTextFile('ahd-timetable-template.csv', templateCsv(rows), 'csv');
  };

  return (
    <>
      <Group>
        <Row k="settings.calc.method" stacked>
          <div className="flex flex-col gap-2">
            <Select<MethodId>
              label={t('settings.calc.method')}
              value={calc.method as MethodId}
              onChange={(v) => update((d) => void (d.calc.method = v))}
              className="w-full max-w-md"
              options={METHOD_IDS.map((m) => ({ value: m, label: t(`methods.${m}`) }))}
            />
            <p className="text-[0.8125rem] text-ink-faint">
              {t('settings.calc.source')}: <span className="selectable">{method.source}</span>
            </p>
            {method.note ? <p className="text-[0.8125rem] text-ink-muted">{method.note}</p> : null}
          </div>
        </Row>
        <Row k="settings.calc.customAngles">
          <Toggle
            checked={custom}
            onChange={(v) =>
              update((d) => {
                if (v) {
                  d.calc.fajrAngle = method.fajrAngle ?? 18;
                  d.calc.ishaAngle = method.ishaInterval ? null : (method.ishaAngle ?? 17);
                  d.calc.ishaInterval = method.ishaInterval ?? null;
                } else {
                  d.calc.fajrAngle = d.calc.ishaAngle = d.calc.ishaInterval = d.calc.maghribAngle = null;
                  if (d.calc.method === 'custom') d.calc.method = 'mwl';
                }
              })
            }
            label={t('settings.calc.customAngles')}
          />
        </Row>
        {custom ? (
          <div className="flex flex-wrap gap-4 py-4">
            <label className="flex flex-col gap-1.5 text-[0.875rem] text-ink-muted">
              {t('settings.calc.fajrAngle')}
              <NumberField label={t('settings.calc.fajrAngle')} value={calc.fajrAngle} step={0.1} min={10} max={22} suffix="°" onChange={(v) => update((d) => void (d.calc.fajrAngle = v))} />
            </label>
            <label className="flex flex-col gap-1.5 text-[0.875rem] text-ink-muted">
              {t('settings.calc.ishaAngle')}
              <NumberField
                label={t('settings.calc.ishaAngle')}
                value={calc.ishaAngle}
                step={0.1}
                min={10}
                max={22}
                suffix="°"
                onChange={(v) =>
                  update((d) => {
                    d.calc.ishaAngle = v;
                    if (v !== null) d.calc.ishaInterval = null;
                  })
                }
              />
            </label>
            <label className="flex flex-col gap-1.5 text-[0.875rem] text-ink-muted">
              {t('settings.calc.ishaInterval')}
              <NumberField
                label={t('settings.calc.ishaInterval')}
                value={calc.ishaInterval}
                step={1}
                min={60}
                max={150}
                suffix={t('settings.calc.minutesAfter')}
                onChange={(v) =>
                  update((d) => {
                    d.calc.ishaInterval = v;
                    if (v !== null) d.calc.ishaAngle = null;
                  })
                }
              />
            </label>
            <label className="flex flex-col gap-1.5 text-[0.875rem] text-ink-muted">
              {t('settings.calc.maghribAngle')}
              <NumberField label={t('settings.calc.maghribAngle')} value={calc.maghribAngle} step={0.1} min={0} max={10} suffix="°" placeholder="—" onChange={(v) => update((d) => void (d.calc.maghribAngle = v))} />
            </label>
          </div>
        ) : null}
        <Row k="settings.calc.asr" stacked>
          <Segmented
            label={t('settings.calc.asr')}
            value={calc.asr}
            onChange={(v) => update((d) => void (d.calc.asr = v))}
            options={[
              { value: 'standard', label: t('settings.calc.asrStandard') },
              { value: 'hanafi', label: t('settings.calc.asrHanafi') },
            ]}
          />
        </Row>
        <Row k="settings.calc.highLat">
          <Select<HighLatitudeRuleId>
            label={t('settings.calc.highLat')}
            value={calc.highLat}
            onChange={(v) => update((d) => void (d.calc.highLat = v))}
            className="w-64"
            options={[
              { value: 'auto', label: t('settings.calc.highLatAuto') },
              { value: 'middle', label: t('settings.calc.highLatMiddle') },
              { value: 'seventh', label: t('settings.calc.highLatSeventh') },
              { value: 'twilight', label: t('settings.calc.highLatTwilight') },
            ]}
          />
        </Row>
      </Group>

      <Group title={t('settings.calc.offsets')}>
        <div id="settings.calc.offsets" className="py-4">
          <p className="mb-3 text-[0.875rem] text-ink-muted">{t('settings.calc.offsetsDesc')}</p>
          <TimesTuner />
        </div>
      </Group>

      <Group>
        <Row k="settings.calc.official" stacked>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Toggle checked={calc.useOfficialTimetable} onChange={(v) => update((d) => void (d.calc.useOfficialTimetable = v))} label={t('settings.calc.useOfficial')} />
              <span className="text-ink">{t('settings.calc.useOfficial')}</span>
              <span className="flex-1" />
              <span className="text-[0.875rem] text-ink-muted">{officialDays ? t('settings.calc.officialRows', { count: officialDays }) : t('settings.calc.officialNone')}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" icon={<IconUpload size={16} />} onClick={importTimetable}>
                {t('settings.calc.importTimetable')}
              </Button>
              <Button size="sm" variant="ghost" icon={<IconDownload size={16} />} onClick={downloadTemplate}>
                {t('settings.calc.downloadTemplate')}
              </Button>
              {officialDays ? (
                <Button size="sm" variant="danger" icon={<IconTrash size={16} />} onClick={() => void setOfficial({})}>
                  {t('settings.calc.officialClear')}
                </Button>
              ) : null}
            </div>
            {errors.length ? (
              <ul className="max-h-40 overflow-auto rounded-[10px] bg-danger-soft p-3 text-[0.875rem] text-danger">
                {errors.slice(0, 50).map((e, i) => (
                  <li key={i}>{t('settings.calc.officialError', { row: e.row, column: e.column, message: t(`settings.calc.importErrors.${e.message}`) })}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </Row>
      </Group>

      <Group>
        <Row k="settings.calc.imsak">
          <NumberField label={t('settings.calc.imsak')} value={calc.imsakMinutes} min={0} max={60} suffix={t('common.minUnit')} onChange={(v) => update((d) => void (d.calc.imsakMinutes = v ?? 10))} />
          <Toggle checked={calc.showImsak} onChange={(v) => update((d) => void (d.calc.showImsak = v))} label={t('settings.calc.showImsak')} />
        </Row>
        <Row k="settings.calc.duha">
          <NumberField label={t('settings.calc.duha')} value={calc.duhaMinutes} min={5} max={60} suffix={t('common.minUnit')} onChange={(v) => update((d) => void (d.calc.duhaMinutes = v ?? 15))} />
          <Toggle checked={calc.showDuha} onChange={(v) => update((d) => void (d.calc.showDuha = v))} label={t('settings.calc.showDuha')} />
        </Row>
      </Group>

      <Group>
        <Row k="settings.calc.hijriOffset">
          <Stepper
            size="sm"
            decrementLabel="−1"
            incrementLabel="+1"
            onDecrement={() => update((d) => void (d.calc.hijriOffset = Math.max(-2, d.calc.hijriOffset - 1)))}
            onIncrement={() => update((d) => void (d.calc.hijriOffset = Math.min(2, d.calc.hijriOffset + 1)))}
          >
            <span className="tabular min-w-[4.5rem] text-center font-medium">
              <bdi dir="ltr">{f.num(calc.hijriOffset > 0 ? `+${calc.hijriOffset}` : calc.hijriOffset < 0 ? `−${-calc.hijriOffset}` : '0')}</bdi>
            </span>
          </Stepper>
          <span className="w-44 text-[0.875rem] text-ink-muted">{f.hijri(localDate(DateTime.now().toMillis(), engine?.zone ?? 'UTC'))}</span>
        </Row>
        <Row k="settings.calc.hijriAtMaghrib">
          <Toggle checked={calc.hijriAtMaghrib} onChange={(v) => update((d) => void (d.calc.hijriAtMaghrib = v))} label={t('settings.calc.hijriAtMaghrib')} />
        </Row>
        <Row k="settings.calc.jumuahLabel">
          <Toggle checked={calc.jumuahLabel} onChange={(v) => update((d) => void (d.calc.jumuahLabel = v))} label={t('settings.calc.jumuahLabel')} />
        </Row>
      </Group>
      <ResetSection
        keys={['calc']}
        onReset={(d, def) => {
          // keep the method chosen for the country; reset the rest
          d.calc = { ...structuredClone(def.calc), method: d.calc.method, asr: d.calc.asr };
        }}
      />
    </>
  );
}
