import { useEffect, useState } from 'react';
import { useFmt } from '@/lib/useFmt';
import { useS } from '@/features/settings/store';
import { api, invoke, type PlatformInfo } from '@/lib/bridge';
import type { WidgetLayer } from '@/features/settings/schema';
import { Badge, Button, Segmented, Select, Slider, Toggle } from '@/design/components';
import { IconAlert } from '@/design/icons';
import { Group, ResetSection, Row, useUpdate } from './shared';

function LayerChoice({ value, onChange }: { value: WidgetLayer; onChange: (v: WidgetLayer) => void }) {
  const { t } = useFmt();
  return (
    <Segmented
      size="sm"
      label={t('settings.widgets.layer')}
      value={value}
      onChange={onChange}
      options={[
        { value: 'desktop', label: t('settings.widgets.layerDesktop') },
        { value: 'top', label: t('settings.widgets.layerTop') },
      ]}
    />
  );
}

export default function Widgets() {
  const { t } = useFmt();
  const w = useS((s) => s.widgets);
  const update = useUpdate();
  const [platform, setPlatform] = useState<PlatformInfo | null>(null);
  useEffect(() => {
    void api.platformInfo().then(setPlatform).catch(() => {});
  }, []);
  const os = platform?.os ?? 'linux';
  const wayland = os === 'linux' && platform?.sessionType === 'wayland';

  return (
    <>
      {wayland ? (
        <div className="mb-6 rounded-panel border border-ochre/40 bg-ochre-soft p-5 text-ochre-strong">
          <p className="flex items-center gap-2 font-semibold">
            <IconAlert size={18} />
            {t('settings.widgets.wayland')}
          </p>
          <p className="mt-1 text-[0.9375rem]">{t('settings.widgets.waylandDesc')}</p>
          <label className="mt-3 flex items-center gap-3">
            <Toggle
              checked={w.waylandCompat}
              onChange={(v) => {
                update((d) => void (d.widgets.waylandCompat = v));
                void api.relaunchX11(v);
              }}
              label={t('settings.widgets.waylandCompat')}
            />
            <span className="font-medium">{t('settings.widgets.waylandCompat')}</span>
            <span className="text-[0.8125rem]">{t('settings.widgets.restartNeeded')}</span>
          </label>
        </div>
      ) : null}

      <Group title={t('settings.widgets.main')}>
        <Row k="settings.widgets.main" label={t('settings.widgets.main')} description={t('settings.widgets.mainDesc')}>
          <Toggle checked={w.main.enabled} onChange={(v) => update((d) => void (d.widgets.main.enabled = v))} label={t('settings.widgets.main')} />
        </Row>
        {w.main.enabled ? (
          <>
            <Row k="settings.widgets.layer">
              <LayerChoice value={w.main.layer} onChange={(v) => update((d) => void (d.widgets.main.layer = v))} />
            </Row>
            <Row k="settings.widgets.size">
              <Segmented
                size="sm"
                label={t('settings.widgets.size')}
                value={w.main.size}
                onChange={(v) => update((d) => void (d.widgets.main.size = v))}
                options={[
                  { value: 'M', label: t('settings.widgets.sizeM') },
                  { value: 'L', label: t('settings.widgets.sizeL') },
                ]}
              />
            </Row>
            <Row k="settings.widgets.opacity">
              <Slider label={t('settings.widgets.opacity')} value={Math.round(w.main.opacity * 100)} min={60} max={100} step={5} format={(v) => `${v}%`} onChange={(v) => update((d) => void (d.widgets.main.opacity = v / 100))} className="w-56" />
            </Row>
            <Row k="settings.widgets.lock">
              <Toggle checked={w.main.locked} onChange={(v) => update((d) => void (d.widgets.main.locked = v))} label={t('settings.widgets.lock')} />
            </Row>
            <Row k="settings.widgets.seconds">
              <Toggle checked={w.main.seconds} onChange={(v) => update((d) => void (d.widgets.main.seconds = v))} label={t('settings.widgets.seconds')} />
            </Row>
            <Row k="settings.widgets.resetPosition">
              <Button size="sm" variant="secondary" onClick={() => void invoke('reset_widget_position', { which: 'widget' })}>
                {t('settings.widgets.resetPosition')}
              </Button>
            </Row>
            {os === 'windows' && w.main.layer === 'desktop' ? (
              <Row k="settings.widgets.pinDesktop" label={<span className="flex items-center gap-2">{t('settings.widgets.pinDesktop')} <Badge tone="ochre">{t('common.experimental')}</Badge></span>}>
                <Toggle checked={w.main.pinDesktopLayer} onChange={(v) => update((d) => void (d.widgets.main.pinDesktopLayer = v))} label={t('settings.widgets.pinDesktop')} />
              </Row>
            ) : null}
          </>
        ) : null}
      </Group>

      <Group title={t('settings.widgets.mini')}>
        <Row k="settings.widgets.mini" label={t('settings.widgets.mini')} description={t('settings.widgets.miniDesc')}>
          <Toggle checked={w.mini.enabled} onChange={(v) => update((d) => void (d.widgets.mini.enabled = v))} label={t('settings.widgets.mini')} />
        </Row>
        {w.mini.enabled ? (
          <>
            <Row k="settings.widgets.layer">
              <LayerChoice value={w.mini.layer} onChange={(v) => update((d) => void (d.widgets.mini.layer = v))} />
            </Row>
            <Row k="settings.widgets.showName">
              <Toggle checked={w.mini.showName} onChange={(v) => update((d) => void (d.widgets.mini.showName = v))} label={t('settings.widgets.showName')} />
            </Row>
            <Row k="settings.widgets.opacity">
              <Slider label={t('settings.widgets.opacity')} value={Math.round(w.mini.opacity * 100)} min={60} max={100} step={5} format={(v) => `${v}%`} onChange={(v) => update((d) => void (d.widgets.mini.opacity = v / 100))} className="w-56" />
            </Row>
            <Row k="settings.widgets.lock">
              <Toggle checked={w.mini.locked} onChange={(v) => update((d) => void (d.widgets.mini.locked = v))} label={t('settings.widgets.lock')} />
            </Row>
            <Row k="settings.widgets.seconds">
              <Toggle checked={w.mini.seconds} onChange={(v) => update((d) => void (d.widgets.mini.seconds = v))} label={t('settings.widgets.seconds')} />
            </Row>
            <Row k="settings.widgets.resetPosition">
              <Button size="sm" variant="secondary" onClick={() => void invoke('reset_widget_position', { which: 'mini' })}>
                {t('settings.widgets.resetPosition')}
              </Button>
            </Row>
          </>
        ) : null}
      </Group>

      <Group title={t('settings.widgets.indicator')}>
        {os === 'linux' && platform?.statusNotifier === false ? (
          <div className="py-4 text-[0.9375rem] text-ochre-strong">
            <p className="font-semibold">{t('settings.widgets.noTray')}</p>
            <p>{t('settings.widgets.noTrayDesc')}</p>
          </div>
        ) : null}
        <Row k="settings.widgets.indicator">
          <Toggle checked={w.indicator.enabled} onChange={(v) => update((d) => void (d.widgets.indicator.enabled = v))} label={t('settings.widgets.indicator')} />
        </Row>
        {w.indicator.enabled && os === 'windows' ? (
          <>
            <Row k="settings.widgets.dynamicIcon">
              <Toggle checked={w.indicator.dynamicTrayIcon} onChange={(v) => update((d) => void (d.widgets.indicator.dynamicTrayIcon = v))} label={t('settings.widgets.dynamicIcon')} />
            </Row>
            <Row k="settings.widgets.pill">
              <Toggle checked={w.indicator.pill} onChange={(v) => update((d) => void (d.widgets.indicator.pill = v))} label={t('settings.widgets.pill')} />
            </Row>
            <Row k="settings.widgets.pillLock">
              <Toggle checked={w.indicator.pillLocked} onChange={(v) => update((d) => void (d.widgets.indicator.pillLocked = v))} label={t('settings.widgets.pillLock')} />
            </Row>
          </>
        ) : null}
        {w.indicator.enabled && os !== 'windows' ? (
          <Row k="settings.widgets.panelLabel">
            <Toggle checked={w.indicator.panelLabel} onChange={(v) => update((d) => void (d.widgets.indicator.panelLabel = v))} label={t('settings.widgets.panelLabel')} />
          </Row>
        ) : null}
        {w.indicator.enabled ? (
          <Row k="settings.widgets.labelFormat">
            <Select
              label={t('settings.widgets.labelFormat')}
              value={w.indicator.labelFormat}
              onChange={(v) => update((d) => void (d.widgets.indicator.labelFormat = v))}
              className="w-72"
              options={[
                { value: 'name-value', label: t('settings.widgets.labelNameValue') },
                { value: 'value', label: t('settings.widgets.labelValue') },
                { value: 'name-time', label: t('settings.widgets.labelNameTime') },
              ]}
            />
          </Row>
        ) : null}
        <Row k="settings.widgets.trayStyle">
          <Select
            label={t('settings.widgets.trayStyle')}
            value={w.indicator.trayIconStyle}
            onChange={(v) => update((d) => void (d.widgets.indicator.trayIconStyle = v))}
            className="w-56"
            options={[
              { value: 'auto', label: t('settings.widgets.trayStyleAuto') },
              { value: 'light', label: t('settings.widgets.trayStyleLight') },
              { value: 'dark', label: t('settings.widgets.trayStyleDark') },
            ]}
          />
        </Row>
        <Row k="settings.widgets.hideTray">
          <Toggle checked={w.indicator.hideTrayIcon} disabled={!w.indicator.enabled || os !== 'windows'} onChange={(v) => update((d) => void (d.widgets.indicator.hideTrayIcon = v))} label={t('settings.widgets.hideTray')} />
        </Row>
      </Group>
      <ResetSection keys={['widgets']} />
    </>
  );
}
