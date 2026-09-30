import { useFmt } from '@/lib/useFmt';
import { useS } from '@/features/settings/store';
import { Select, Toggle } from '@/design/components';
import { Group, ResetSection, Row, useUpdate } from './shared';

const THRESHOLDS = [5, 10, 15, 20, 25, 30, 45, 60, 90, 120];

export default function Timer() {
  const { t } = useFmt();
  const timer = useS((s) => s.timer);
  const update = useUpdate();
  return (
    <>
      <Group>
        <Row k="settings.timer.threshold">
          <Select
            label={t('settings.timer.threshold')}
            value={timer.countdownStart === 'halfway' ? 'halfway' : String(timer.thresholdMinutes)}
            onChange={(v) =>
              update((d) => {
                d.timer.countdownStart = v === 'halfway' ? 'halfway' : 'threshold';
                if (v !== 'halfway') d.timer.thresholdMinutes = Number(v);
              })
            }
            className="w-60"
            options={[
              { value: 'halfway', label: t('settings.timer.thresholdHalfway') },
              ...THRESHOLDS.map((m) => ({ value: String(m), label: t('settings.timer.thresholdValue', { minutes: t('time.minutes', { count: m }) }) })),
            ]}
          />
        </Row>
        <Row k="settings.timer.includeSunrise">
          <Toggle checked={timer.includeSunrise} onChange={(v) => update((d) => void (d.timer.includeSunrise = v))} label={t('settings.timer.includeSunrise')} />
        </Row>
      </Group>
      <Group>
        <Row k="settings.timer.secondsMain">
          <Toggle checked={timer.secondsMain} onChange={(v) => update((d) => void (d.timer.secondsMain = v))} label={t('settings.timer.secondsMain')} />
        </Row>
        <Row k="settings.timer.secondsWidget">
          <Toggle checked={timer.secondsWidget} onChange={(v) => update((d) => void (d.timer.secondsWidget = v))} label={t('settings.timer.secondsWidget')} />
        </Row>
        <Row k="settings.timer.secondsTaskbar">
          <Toggle checked={timer.secondsTaskbar} onChange={(v) => update((d) => void (d.timer.secondsTaskbar = v))} label={t('settings.timer.secondsTaskbar')} />
        </Row>
      </Group>
      <ResetSection keys={['timer']} />
    </>
  );
}
