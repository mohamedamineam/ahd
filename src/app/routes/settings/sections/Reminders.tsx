import { useFmt } from '@/lib/useFmt';
import { useS } from '@/features/settings/store';
import { ReminderList, newReminder } from '@/features/reminders/ReminderEditor';
import { ADHAN_PRAYERS } from '@/features/prayer/types';
import { Button, NumberField, TextInput, Toggle } from '@/design/components';
import { IconPlus } from '@/design/icons';
import { Group, ResetSection, Row, useUpdate } from './shared';

export default function Reminders() {
  const { t } = useFmt();
  const r = useS((s) => s.reminders);
  const update = useUpdate();
  return (
    <>
      <p className="mb-4 text-ink-muted">{t('settings.reminders.desc')}</p>
      <Group title={t('settings.reminders.presets')}>
        <div id="settings.reminders.presets" className="flex flex-wrap gap-2 py-4">
          <Button
            size="sm"
            variant="secondary"
            icon={<IconPlus size={15} />}
            onClick={() => update((d) => void d.reminders.items.push(...ADHAN_PRAYERS.map((p) => newReminder(p, -10))))}
          >
            {t('settings.reminders.preset10')}
          </Button>
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
          <TextInput type="time" dir="ltr" aria-label={t('settings.reminders.kahfTime')} value={r.fridayKahfTime} onChange={(e) => update((d) => void (d.reminders.fridayKahfTime = e.target.value || '09:00'))} className="w-32" />
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
