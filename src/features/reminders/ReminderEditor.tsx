import { useFmt } from '@/lib/useFmt';
import { useSettings, useS } from '@/features/settings/store';
import type { Reminder, ReminderType } from '@/features/settings/schema';
import { PRAYER_IDS, type PrayerId } from '@/features/prayer/types';
import { Button, Checkbox, IconButton, Select, Stepper, TextInput, Toggle } from '@/design/components';
import { IconPlus, IconTrash } from '@/design/icons';
import { SoundSelect } from '@/features/adhan/AdhanControls';

export function newReminder(prayer: PrayerId, offsetMinutes = -10): Reminder {
  return {
    id: `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    prayer,
    offsetMinutes,
    type: 'notification',
    message: '',
    enabled: true,
  };
}

function ReminderRow({ r, showPrayer }: { r: Reminder; showPrayer: boolean }) {
  const f = useFmt();
  const { t } = f;
  const update = useSettings((s) => s.update);
  const patch = (fn: (x: Reminder) => void) =>
    update((d) => {
      const x = d.reminders.items.find((i) => i.id === r.id);
      if (x) fn(x);
    });
  const minutes = Math.abs(r.offsetMinutes);
  const whenText = r.offsetMinutes < 0 ? t('settings.reminders.minutesBefore', { minutes: t('time.minutes', { count: minutes }) }) : t('settings.reminders.minutesAfter', { minutes: t('time.minutes', { count: minutes }) });
  return (
    <li className="flex flex-col gap-3 rounded-[12px] border border-line-soft bg-surface-raised p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Toggle checked={r.enabled} onChange={(v) => patch((x) => void (x.enabled = v))} label={t('common.on')} />
        {showPrayer ? (
          <Select
            size="sm"
            label={t('settings.reminders.offset')}
            value={r.prayer}
            onChange={(v) => patch((x) => void (x.prayer = v))}
            options={PRAYER_IDS.map((p) => ({ value: p, label: f.prayer(p) }))}
          />
        ) : null}
        <Stepper
          size="sm"
          decrementLabel={t('settings.reminders.before')}
          incrementLabel={t('settings.reminders.after')}
          onDecrement={() => patch((x) => void (x.offsetMinutes = Math.max(-120, x.offsetMinutes - 1 === 0 ? -1 : x.offsetMinutes - 1)))}
          onIncrement={() => patch((x) => void (x.offsetMinutes = Math.min(120, x.offsetMinutes + 1 === 0 ? 1 : x.offsetMinutes + 1)))}
        >
          <span className="min-w-[8.5rem] px-1 text-center text-[0.875rem] font-medium text-ink">{whenText}</span>
        </Stepper>
        <div className="flex-1" />
        <IconButton label={t('common.delete')} size="sm" onClick={() => update((d) => void (d.reminders.items = d.reminders.items.filter((i) => i.id !== r.id)))}>
          <IconTrash size={17} />
        </IconButton>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Select<ReminderType>
          size="sm"
          label={t('settings.reminders.type')}
          value={r.type}
          onChange={(v) => patch((x) => void (x.type = v))}
          options={[
            { value: 'notification', label: t('settings.reminders.typeNotification') },
            { value: 'tone', label: t('settings.reminders.typeTone') },
            { value: 'sound', label: t('settings.reminders.typeSound') },
          ]}
        />
        {r.type === 'sound' ? (
          <SoundSelect label={t('settings.adhan.sound')} value={r.sound ?? ''} onChange={(v) => patch((x) => void (x.sound = v))} />
        ) : null}
      </div>
      <TextInput
        aria-label={t('settings.reminders.message')}
        placeholder={t('settings.reminders.messagePlaceholder')}
        value={r.message}
        onChange={(e) => patch((x) => void (x.message = e.target.value))}
      />
      {r.offsetMinutes > 0 ? (
        <Checkbox
          checked={r.action === 'adhkar'}
          onChange={(v) => patch((x) => void (x.action = v ? 'adhkar' : undefined))}
          label={t('settings.reminders.openAdhkar')}
        />
      ) : null}
    </li>
  );
}

export function ReminderList({ prayer }: { prayer?: PrayerId }) {
  const { t } = useFmt();
  const items = useS((s) => s.reminders.items);
  const update = useSettings((s) => s.update);
  const list = prayer ? items.filter((r) => r.prayer === prayer) : items;
  return (
    <div className="flex flex-col gap-3">
      {list.length ? (
        <ul className="flex flex-col gap-2">
          {list.map((r) => (
            <ReminderRow key={r.id} r={r} showPrayer={!prayer} />
          ))}
        </ul>
      ) : (
        <p className="text-[0.875rem] text-ink-muted">{t('settings.reminders.none')}</p>
      )}
      <div>
        <Button size="sm" variant="soft" icon={<IconPlus size={16} />} onClick={() => update((d) => void d.reminders.items.push(newReminder(prayer ?? 'dhuhr')))}>
          {t('settings.reminders.add')}
        </Button>
      </div>
    </div>
  );
}
