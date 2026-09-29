import { useFmt } from '@/lib/useFmt';
import { useS } from '@/features/settings/store';
import type { AdhkarAnchor, AdhkarSchedule } from '@/features/settings/schema';
import { ADHAN_PRAYERS } from '@/features/prayer/types';
import { Checkbox, NumberField, Select, Slider, TimeField, Toggle } from '@/design/components';
import { Group, ResetSection, Row, useUpdate } from './shared';

const ANCHORS: AdhkarAnchor[] = ['fixed', 'fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];

function ScheduleEditor({ value, onChange }: { value: AdhkarSchedule; onChange: (v: AdhkarSchedule) => void }) {
  const f = useFmt();
  const { t } = f;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Toggle checked={value.enabled} onChange={(v) => onChange({ ...value, enabled: v })} label={t('common.on')} />
      <Select<AdhkarAnchor>
        size="sm"
        label={t('settings.adhkarSettings.anchor')}
        value={value.anchor}
        onChange={(v) => onChange({ ...value, anchor: v })}
        options={ANCHORS.map((a) => ({ value: a, label: a === 'fixed' ? t('settings.adhkarSettings.anchorFixed') : t('settings.adhkarSettings.afterPrayer', { prayer: f.prayer(a) }) }))}
      />
      {value.anchor === 'fixed' ? (
        <TimeField label={t('settings.adhkarSettings.anchorFixed')} value={value.fixedTime} format={f.clock} onChange={(v) => onChange({ ...value, fixedTime: v })} />
      ) : (
        <NumberField label={t('settings.adhkarSettings.offset')} value={value.offsetMinutes} min={0} max={240} suffix={t('common.minUnit')} onChange={(v) => onChange({ ...value, offsetMinutes: v ?? 0 })} />
      )}
    </div>
  );
}

export default function AdhkarSettings() {
  const f = useFmt();
  const { t } = f;
  const a = useS((s) => s.adhkar);
  const update = useUpdate();
  return (
    <>
      <Group>
        <Row k="settings.adhkarSettings.notifications">
          <Toggle checked={a.notifications} onChange={(v) => update((d) => void (d.adhkar.notifications = v))} label={t('settings.adhkarSettings.notifications')} />
        </Row>
      </Group>
      <Group>
        <Row k="settings.adhkarSettings.morning" stacked>
          <ScheduleEditor value={a.morning} onChange={(v) => update((d) => void (d.adhkar.morning = v))} />
        </Row>
        <Row k="settings.adhkarSettings.evening" stacked>
          <ScheduleEditor value={a.evening} onChange={(v) => update((d) => void (d.adhkar.evening = v))} />
        </Row>
        <Row k="settings.adhkarSettings.sleep" stacked>
          <ScheduleEditor value={a.sleep} onChange={(v) => update((d) => void (d.adhkar.sleep = v))} />
        </Row>
        <Row k="settings.adhkarSettings.afterSalah" stacked>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Toggle checked={a.afterSalah.enabled} onChange={(v) => update((d) => void (d.adhkar.afterSalah.enabled = v))} label={t('settings.adhkarSettings.afterSalah')} />
              <NumberField label={t('settings.adhkarSettings.offset')} value={a.afterSalah.offsetMinutes} min={0} max={60} suffix={t('common.minUnit')} onChange={(v) => update((d) => void (d.adhkar.afterSalah.offsetMinutes = v ?? 10))} />
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {ADHAN_PRAYERS.map((p) => (
                <Checkbox key={p} checked={a.afterSalah.prayers[p]} onChange={(v) => update((d) => void (d.adhkar.afterSalah.prayers[p] = v))} label={f.prayer(p)} />
              ))}
            </div>
          </div>
        </Row>
        <Row k="settings.adhkarSettings.periodic">
          <NumberField label={t('settings.adhkarSettings.every')} value={a.periodic.everyMinutes} min={15} max={240} step={15} suffix={t('common.minUnit')} onChange={(v) => update((d) => void (d.adhkar.periodic.everyMinutes = v ?? 60))} />
          <Toggle checked={a.periodic.enabled} onChange={(v) => update((d) => void (d.adhkar.periodic.enabled = v))} label={t('settings.adhkarSettings.periodic')} />
        </Row>
      </Group>
      <Group>
        <Row k="settings.adhkarSettings.fontSize">
          <Slider label={t('settings.adhkarSettings.fontSize')} value={Math.round(a.fontScale * 100)} min={80} max={180} step={10} format={(v) => `${v}%`} onChange={(v) => update((d) => void (d.adhkar.fontScale = v / 100))} className="w-56" />
        </Row>
        <Row k="settings.adhkarSettings.autoAdvance">
          <Toggle checked={a.autoAdvance} onChange={(v) => update((d) => void (d.adhkar.autoAdvance = v))} label={t('settings.adhkarSettings.autoAdvance')} />
        </Row>
        <Row k="settings.adhkarSettings.counterAnimation">
          <Toggle checked={a.counterAnimation} onChange={(v) => update((d) => void (d.adhkar.counterAnimation = v))} label={t('settings.adhkarSettings.counterAnimation')} />
        </Row>
      </Group>
      <ResetSection keys={['adhkar']} />
    </>
  );
}
