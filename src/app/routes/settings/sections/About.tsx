import { useEffect, useState } from 'react';
import { useFmt } from '@/lib/useFmt';
import { api, IS_TAURI, type PlatformInfo } from '@/lib/bridge';
import { AhdMark } from '@/design/brand/AhdMark';
import { Button, Dialog } from '@/design/components';
import { IconExternal } from '@/design/icons';
import { HadithInscription } from '../../home/HadithInscription';
import attributions from '../../../../../docs/ATTRIBUTIONS.md?raw';
import privacy from '../../../../../docs/PRIVACY.md?raw';
import pkg from '../../../../../package.json';

const REPO = 'https://github.com/ahdapp/ahd';

async function openUrl(url: string) {
  if (IS_TAURI) {
    const { openUrl: open } = await import('@tauri-apps/plugin-opener');
    await open(url);
  } else window.open(url, '_blank', 'noopener');
}

function Markdown({ text }: { text: string }) {
  // Tiny renderer for our own docs: headings, lists, paragraphs, links as plain text.
  return (
    <div className="selectable flex flex-col gap-2 text-[0.9375rem] leading-relaxed text-ink" dir="ltr">
      {text.split(/\n{2,}/).map((block, i) => {
        if (block.startsWith('#')) {
          const level = block.match(/^#+/)![0].length;
          const content = block.replace(/^#+\s*/, '');
          return level <= 2 ? (
            <h3 key={i} className="mt-3 text-lg font-semibold">
              {content}
            </h3>
          ) : (
            <h4 key={i} className="mt-2 font-semibold">
              {content}
            </h4>
          );
        }
        if (block.trim().startsWith('|')) {
          return (
            <pre key={i} className="overflow-x-auto rounded-[8px] bg-surface-sunk p-3 text-[0.8125rem] whitespace-pre">
              {block}
            </pre>
          );
        }
        if (/^\s*[-*] /.test(block)) {
          return (
            <ul key={i} className="list-disc ps-5">
              {block.split('\n').map((l, k) => (
                <li key={k}>{l.replace(/^\s*[-*] /, '')}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{block}</p>;
      })}
    </div>
  );
}

export default function About() {
  const f = useFmt();
  const { t } = f;
  const [platform, setPlatform] = useState<PlatformInfo | null>(null);
  const [doc, setDoc] = useState<'attributions' | 'privacy' | null>(null);
  useEffect(() => {
    void api.platformInfo().then(setPlatform).catch(() => {});
  }, []);
  return (
    <>
      <div className="mb-8 flex flex-col items-center rounded-hero border border-line-soft bg-surface px-6 py-8 text-center">
        <AhdMark size={96} />
        <h3 className="font-display mt-4 text-[2rem] text-ink">{t('app.name')}</h3>
        <p className="text-ink-muted">{t('settings.about.version', { version: platform?.version ?? pkg.version })}</p>
        <p className="mt-5 text-[0.9375rem] text-ink-muted">{t('settings.about.nameMeaning')}</p>
        <HadithInscription className="mt-2 w-full max-w-2xl" />
      </div>
      <div className="divide-y divide-line-soft rounded-panel border border-line-soft bg-surface px-5">
        <div className="flex items-center justify-between py-4">
          <span className="font-medium text-ink">{t('settings.about.license')}</span>
          <span className="text-ink-muted">{t('settings.about.licenseValue')}</span>
        </div>
        {(
          [
            ['settings.about.source', REPO],
            ['settings.about.report', `${REPO}/issues`],
          ] as const
        ).map(([k, url]) => (
          <div key={k} className="flex items-center justify-between py-3">
            <span className="font-medium text-ink">{t(k)}</span>
            <Button size="sm" variant="ghost" icon={<IconExternal size={16} />} onClick={() => void openUrl(url)}>
              <bdi dir="ltr">{url.replace('https://', '')}</bdi>
            </Button>
          </div>
        ))}
        <div className="flex items-center justify-between py-3">
          <span className="font-medium text-ink">{t('settings.about.attributions')}</span>
          <Button size="sm" variant="secondary" onClick={() => setDoc('attributions')}>
            {t('common.open')}
          </Button>
        </div>
        <div className="flex items-center justify-between py-3">
          <span className="font-medium text-ink">{t('settings.about.privacy')}</span>
          <Button size="sm" variant="secondary" onClick={() => setDoc('privacy')}>
            {t('common.open')}
          </Button>
        </div>
        {IS_TAURI ? (
          <div className="flex items-center justify-between py-3">
            <span className="font-medium text-ink">{t('settings.about.logs')}</span>
            <Button size="sm" variant="ghost" onClick={() => void api.openLogs()}>
              {t('common.open')}
            </Button>
          </div>
        ) : null}
      </div>
      <Dialog
        open={doc !== null}
        onClose={() => setDoc(null)}
        title={doc === 'privacy' ? t('settings.about.privacy') : t('settings.about.attributions')}
        size="lg"
        closeLabel={t('common.close')}
      >
        <Markdown text={doc === 'privacy' ? privacy : attributions} />
      </Dialog>
    </>
  );
}
