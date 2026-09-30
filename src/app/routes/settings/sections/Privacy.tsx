import { useState } from 'react';
import { useFmt } from '@/lib/useFmt';
import { useS, useSettings } from '@/features/settings/store';
import { defaultSettings, migrateSettings } from '@/features/settings/schema';
import { db, type ExportedData } from '@/lib/db';
import { kv } from '@/lib/storage';
import { openTextFile, saveTextFile } from '@/lib/files';
import { Button, Dialog, Toggle, toast } from '@/design/components';
import { IconDownload, IconShield, IconUpload } from '@/design/icons';
import { Group, Row, useUpdate } from './shared';

export default function Privacy() {
  const { t, lang } = useFmt();
  const p = useS((s) => s.privacy);
  const settings = useSettings((s) => s.s);
  const replace = useSettings((s) => s.replace);
  const update = useUpdate();
  const [confirmReset, setConfirmReset] = useState(false);

  const toggles: [keyof typeof p, string][] = [
    ['placeSearch', 'settings.privacy.placeSearch'],
    ['mapTiles', 'settings.privacy.mapTiles'],
    ['library', 'settings.privacy.library'],
    ['tafsirDownloads', 'settings.privacy.tafsir'],
    ['updateChecks', 'settings.privacy.updates'],
  ];

  return (
    <>
      <div className="mb-6 flex items-center gap-3 rounded-panel bg-sage-soft px-5 py-4 text-sage-strong">
        <IconShield size={22} />
        <p className="font-medium">{t('settings.privacy.noTelemetry')}</p>
      </div>
      <Group title={t('settings.privacy.network')}>
        <p className="pt-4 text-[0.875rem] text-ink-muted">{t('settings.privacy.networkDesc')}</p>
        {toggles.map(([key, label]) => (
          <Row key={key} k={label} description="">
            <Toggle checked={p[key]} onChange={(v) => update((d) => void (d.privacy[key] = v))} label={t(label)} />
          </Row>
        ))}
      </Group>
      <Group>
        <Row k="settings.privacy.export">
          <Button
            size="sm"
            variant="secondary"
            icon={<IconDownload size={16} />}
            onClick={async () => {
              const data = { app: 'ahd', version: 1, exportedAt: new Date().toISOString(), settings, data: await db.exportAll() };
              await saveTextFile(`ahd-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), 'json');
            }}
          >
            {t('common.export')}
          </Button>
        </Row>
        <Row k="settings.privacy.import">
          <Button
            size="sm"
            variant="secondary"
            icon={<IconUpload size={16} />}
            onClick={async () => {
              const file = await openTextFile(['json']);
              if (!file) return;
              try {
                const parsed = JSON.parse(file.text) as { app?: string; settings?: unknown; data?: ExportedData };
                if (parsed.app !== 'ahd') throw new Error('not a 3ahd backup');
                if (parsed.data) await db.importAll(parsed.data);
                if (parsed.settings) replace(migrateSettings(parsed.settings, lang));
                toast(t('settings.privacy.imported'), 'success');
              } catch {
                toast(t('errors.generic'), 'error');
              }
            }}
          >
            {t('common.import')}
          </Button>
        </Row>
        <Row k="settings.privacy.resetApp">
          <Button size="sm" variant="danger" onClick={() => setConfirmReset(true)}>
            {t('settings.privacy.resetApp')}
          </Button>
        </Row>
      </Group>
      <Dialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title={t('settings.privacy.resetApp')}
        description={t('settings.privacy.resetConfirm')}
        size="sm"
        closeLabel={t('common.close')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                await db.clearAll();
                await kv.clear();
                replace(defaultSettings(lang));
                setConfirmReset(false);
                location.hash = '#/onboarding';
              }}
            >
              {t('common.reset')}
            </Button>
          </>
        }
      />
    </>
  );
}
