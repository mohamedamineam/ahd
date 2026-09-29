import { useState, type ReactNode } from 'react';
import { useFmt } from '@/lib/useFmt';
import { useSettings } from '@/features/settings/store';
import { defaultSettings, type Settings } from '@/features/settings/schema';
import { Button, Dialog } from '@/design/components';
import { IconReset } from '@/design/icons';

export function useUpdate() {
  return useSettings((s) => s.update);
}

/** "Reset this section" (brief §18) with a confirmation. */
export function ResetSection({ keys, onReset }: { keys: (keyof Settings)[]; onReset?: (draft: Settings, defaults: Settings) => void }) {
  const { t, lang } = useFmt();
  const update = useUpdate();
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-8 flex justify-end">
      <Button variant="ghost" size="sm" icon={<IconReset size={16} />} onClick={() => setOpen(true)}>
        {t('common.resetSection')}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t('common.resetSection')}
        description={t('common.resetSectionConfirm')}
        size="sm"
        closeLabel={t('common.close')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                const defaults = defaultSettings(lang);
                update((d) => {
                  if (onReset) onReset(d, defaults);
                  else for (const k of keys) (d as unknown as Record<string, unknown>)[k] = structuredClone(defaults[k]);
                });
                setOpen(false);
              }}
            >
              {t('common.reset')}
            </Button>
          </>
        }
      />
    </div>
  );
}

export function Row({ k, children, stacked, label, description }: { k: string; children?: ReactNode; stacked?: boolean; label?: ReactNode; description?: ReactNode }) {
  const { t } = useFmt();
  const desc = description ?? t(`${k}Desc`, { defaultValue: '' });
  return (
    <div id={k} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-[10px] py-4 transition-colors">
      <div className={stacked ? 'w-full' : 'min-w-0 flex-1 basis-64'}>
        <div className="font-medium text-ink">{label ?? t(k)}</div>
        {desc ? <p className="mt-0.5 text-[0.875rem] leading-relaxed text-ink-muted">{desc}</p> : null}
      </div>
      {children ? <div className={stacked ? 'w-full' : 'flex shrink-0 items-center gap-2'}>{children}</div> : null}
    </div>
  );
}

export function Group({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-6">
      {title ? <h3 className="mb-2 text-[0.9375rem] font-semibold text-ink">{title}</h3> : null}
      <div className="divide-y divide-line-soft rounded-panel border border-line-soft bg-surface px-5">{children}</div>
    </section>
  );
}
