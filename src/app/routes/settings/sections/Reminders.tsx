import { useFmt } from '@/lib/useFmt';
import { useS } from '@/features/settings/store';
import { ReminderList, newReminder } from '@/features/reminders/ReminderEditor';
import { Button, NumberField, TimeField, Toggle } from '@/design/components';
import { IconPlus } from '@/design/icons';
import { Group, ResetSection, Row, useUpdate } from './shared';

export default function Reminders() {
  const f = useFmt();
  const { t } = f;
  const r = useS((s) => s.reminders);
  const update = useUpdate();
  return (
    <>
      <p className="mb-4 text-ink-muted">{t('settings.reminders.desc')}</p>
      <Group>
        <Row k="settings.reminders.beforePrayer">
          <NumberField
            label={t('settings.reminders.beforePrayer')}
            value={r.beforePrayer.minutes}
            min={1}
            max={120}
            suffix={t('common.minUnit')}
            onChange={(v) => update((d) => void (d.reminders.beforePrayer.minutes = v ?? 10))}
          />
          <Toggle checked={r.beforePrayer.enabled} onChange={(v) => update((d) => void (d.reminders.beforePrayer.enabled = v))} label={t('settings.reminders.beforePrayer')} />
        </Row>
        {r.beforePrayer.enabled ? (
          <Row k="settings.reminders.beforePrayerTone">
            <Toggle checked={r.beforePrayer.type === 'tone'} onChange={(v) => update((d) => void (d.reminders.beforePrayer.type = v ? 'tone' : 'notification'))} label={t('settings.reminders.beforePrayerTone')} />
          </Row>
        ) : null}
      </Group>

      <Group title={t('settings.reminders.presets')}>
        <div id="settings.reminders.presets" className="flex flex-wrap gap-2 py-4">
          <Button
            size="sm"
            variant="secondary"
            icon={<IconPlus size={15} />}
            onClick={() => update((d) => void d.reminders.items.push(newReminder('sunrise', -20)))}
          >
            {t('settings.reminders.presetSunrise')}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={<IconPlus size={15} />}
            onClick={() =>
              update((d) => {
                d.reminders.fridayJumuahBefore = true;
                d.reminders.fridayJumuahMinutes = 60;
                d.reminders.fridayKahf = true;
              })
            }
          >
            {t('settings.reminders.presetFriday')}
          </Button>
        </div>
      </Group>

      <Group title={t('settings.reminders.title')}>
        <div className="py-4">
          <ReminderList />
        </div>
      </Group>

      <Group title={t('settings.reminders.friday')}>
        <Row k="settings.reminders.kahf">
          <TimeField label={t('settings.reminders.kahfTime')} value={r.fridayKahfTime} format={f.clock} onChange={(v) => update((d) => void (d.reminders.fridayKahfTime = v))} />
          <Toggle checked={r.fridayKahf} onChange={(v) => update((d) => void (d.reminders.fridayKahf = v))} label={t('settings.reminders.kahf')} />
        </Row>
        <Row k="settings.reminders.jumuahBefore">
          <NumberField label={t('settings.reminders.jumuahBefore')} value={r.fridayJumuahMinutes} min={5} max={240} suffix={t('common.minUnit')} onChange={(v) => update((d) => void (d.reminders.fridayJumuahMinutes = v ?? 60))} />
          <Toggle checked={r.fridayJumuahBefore} onChange={(v) => update((d) => void (d.reminders.fridayJumuahBefore = v))} label={t('settings.reminders.jumuahBefore')} />
        </Row>
      </Group>
      <ResetSection keys={['reminders']} />
    </>
  );
}
