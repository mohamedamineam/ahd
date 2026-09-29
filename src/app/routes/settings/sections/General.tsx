import { useEffect, useState } from 'react';
import { useFmt } from '@/lib/useFmt';
import { useS } from '@/features/settings/store';
import { api, type PlatformInfo } from '@/lib/bridge';
import { Segmented, Select, Toggle } from '@/design/components';
import type { MonthStyle } from '@/lib/format';
import { Group, ResetSection, Row, useUpdate } from './shared';

export default function General() {
  const { t } = useFmt();
  const g = useS((s) => s.general);
  const update = useUpdate();
  const [platform, setPlatform] = useState<PlatformInfo | null>(null);
  useEffect(() => {
    void api.platformInfo().then(setPlatform).catch(() => {});
  }, []);
  return (
    <>
      <Group>
        <Row k="settings.general.language">
          <Segmented
            label={t('settings.general.language')}
            value={g.language}
            onChange={(v) => update((d) => void (d.general.language = v))}
            options={[
              { value: 'ar', label: 'العربية' },
              { value: 'en', label: 'English' },
            ]}
          />
        </Row>
        <Row k="settings.general.digits">
          <Segmented
            label={t('settings.general.digits')}
            value={g.digits}
            onChange={(v) => update((d) => void (d.general.digits = v))}
            options={[
              { value: 'latn', label: <bdi dir="ltr">{t('settings.general.digitsLatn', { postProcess: [] })}</bdi> },
              { value: 'arab', label: t('settings.general.digitsArab', { postProcess: [] }) },
            ]}
          />
        </Row>
        <Row k="settings.general.timeFormat">
          <Segmented
            label={t('settings.general.timeFormat')}
            value={g.timeFormat}
            onChange={(v) => update((d) => void (d.general.timeFormat = v))}
            options={[
              { value: '24h', label: t('settings.general.h24') },
              { value: '12h', label: t('settings.general.h12') },
            ]}
          />
        </Row>
        <Row k="settings.general.monthStyle">
          <Select<MonthStyle>
            label={t('settings.general.monthStyle')}
            value={g.monthStyle}
            onChange={(v) => update((d) => void (d.general.monthStyle = v))}
            className="w-72"
            options={[
              { value: 'maghreb', label: t('settings.general.maghreb') },
              { value: 'egypt', label: t('settings.general.egypt') },
              { value: 'levant', label: t('settings.general.levant') },
            ]}
          />
        </Row>
      </Group>
      <Group>
        <Row k="settings.general.startWithSystem">
          <Toggle checked={g.startWithSystem} onChange={(v) => update((d) => void (d.general.startWithSystem = v))} label={t('settings.general.startWithSystem')} />
        </Row>
        <Row k="settings.general.keepInTray">
          <Toggle checked={g.keepInTray} onChange={(v) => update((d) => void (d.general.keepInTray = v))} label={t('settings.general.keepInTray')} />
        </Row>
        {platform?.store ? (
          <Row k="settings.general.checkUpdates" description={t('settings.general.storeUpdates')} />
        ) : (
          <Row k="settings.general.checkUpdates">
            <Toggle checked={g.checkUpdates} onChange={(v) => update((d) => void (d.general.checkUpdates = v))} label={t('settings.general.checkUpdates')} />
          </Row>
        )}
      </Group>
      <ResetSection keys={['general']} />
    </>
  );
}
