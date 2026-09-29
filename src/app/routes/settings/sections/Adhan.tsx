import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { useFmt } from '@/lib/useFmt';
import { useS } from '@/features/settings/store';
import { usePrayer } from '@/features/prayer/store';
import { ADHAN_PRAYERS, type AdhanPrayerId } from '@/features/prayer/types';
import { PrayerAdhanControls, PreviewButton, SoundSelect, soundLabel, useSounds } from '@/features/adhan/AdhanControls';
import { api, IS_TAURI, type AdhanSound } from '@/lib/bridge';
import { pickFilePath } from '@/lib/files';
import { formatClock, fromDigits } from '@/lib/format';
import { Badge, Button, Checkbox, Dialog, IconButton, Kbd, NumberField, Select, TextInput, Toggle, toast } from '@/design/components';
import { IconChevronDown, IconEdit, IconPlus, IconTrash, IconPlay } from '@/design/icons';
import { Group, ResetSection, Row, useUpdate } from './shared';

function PrayerRow({ p }: { p: AdhanPrayerId }) {
  const f = useFmt();
  const { t } = f;
  const cfg = useS((s) => s.adhan.perPrayer[p]);
  const [open, setOpen] = useState(false);
  return (
    <div className="py-1">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 py-3 text-start">
        <span className="w-24 font-medium text-ink">{f.prayer(p)}</span>
        <Badge tone={cfg.mode === 'off' ? 'neutral' : cfg.mode === 'full' ? 'sage' : 'outline'}>{t(`settings.adhan.mode${cfg.mode[0]!.toUpperCase()}${cfg.mode.slice(1)}`)}</Badge>
        <span className="flex-1" />
        {cfg.mode === 'full' || cfg.mode === 'short' ? <span className="tabular text-[0.875rem] text-ink-muted">{Math.round(cfg.volume * 100)}%</span> : null}
        <IconChevronDown size={18} className={clsx('text-ink-muted transition-transform', open && 'rotate-180')} />
      </button>
      {open ? (
        <div className="animate-fade-in pb-4">
          <PrayerAdhanControls prayer={p} />
        </div>
      ) : null}
    </div>
  );
}

function SoundRow({ s }: { s: AdhanSound }) {
  const f = useFmt();
  const { t, lang, digits } = f;
  const reload = usePrayer((st) => st.reloadSounds);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(soundLabel(s, lang));
  const [shortEnd, setShortEnd] = useState(s.shortEndS !== null ? formatClock(s.shortEndS, 'latn') : '');
  const [confirm, setConfirm] = useState(false);
  const save = async () => {
    const m = /^(\d+):(\d{1,2})$/.exec(fromDigits(shortEnd.trim()));
    const secs = m ? Number(m[1]) * 60 + Number(m[2]) : shortEnd.trim() ? Number(fromDigits(shortEnd)) : null;
    await api.updateAdhan(s.id, s.builtin ? null : name.trim() || null, Number.isFinite(secs as number) ? secs : null);
    await reload();
    setEditing(false);
  };
  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex items-center gap-3">
        <PreviewButton sound={s.id} volume={0.8} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-ink">{soundLabel(s, lang)}</div>
          <div className="flex flex-wrap items-center gap-2 text-[0.8125rem] text-ink-muted">
            <span>{t('settings.adhan.duration', { time: formatClock(s.durationS, digits) })}</span>
            <Badge tone={s.builtin ? 'outline' : 'sage'}>{s.builtin ? t('settings.adhan.builtin') : t('settings.adhan.customLabel')}</Badge>
            {s.isFajr ? <Badge tone="ochre">{t('settings.adhan.fajrBadge')}</Badge> : null}
          </div>
        </div>
        <IconButton size="sm" label={t('common.edit')} onClick={() => setEditing((e) => !e)}>
          <IconEdit size={16} />
        </IconButton>
        {!s.builtin ? (
          <IconButton size="sm" label={t('common.delete')} onClick={() => setConfirm(true)}>
            <IconTrash size={16} />
          </IconButton>
        ) : null}
      </div>
      {editing ? (
        <div className="flex flex-wrap items-end gap-3 ps-12">
          {!s.builtin ? <TextInput label={t('common.rename')} value={name} onChange={(e) => setName(e.target.value)} className="w-64" /> : null}
          <TextInput label={t('settings.adhan.shortEnd')} hint={t('settings.adhan.shortEndDesc')} value={shortEnd} onChange={(e) => setShortEnd(e.target.value)} placeholder="0:18" dir="ltr" className="w-40" />
          <Button size="sm" variant="primary" onClick={save}>
            {t('common.save')}
          </Button>
        </div>
      ) : null}
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t('settings.adhan.deleteConfirm', { name: soundLabel(s, lang) })}
        size="sm"
        closeLabel={t('common.close')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                await api.deleteAdhan(s.id);
                await reload();
                setConfirm(false);
              }}
            >
              {t('common.delete')}
            </Button>
          </>
        }
      />
    </li>
  );
}

function ShortcutRecorder() {
  const { t } = useFmt();
  const shortcut = useS((s) => s.adhan.stopShortcut);
  const update = useUpdate();
  const [recording, setRecording] = useState(false);
  useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.key === 'Escape') return setRecording(false);
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;
      const parts: string[] = [];
      if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');
      if (!parts.length) return;
      const key = e.code.startsWith('Key') ? e.code.slice(3) : e.code.startsWith('Digit') ? e.code.slice(5) : e.code;
      parts.push(key);
      const combo = parts.join('+');
      void api
        .setShortcut(combo)
        .then((ok) => {
          if (ok === null) toast(t('settings.adhan.shortcutTaken'), 'warning');
          else update((d) => void (d.adhan.stopShortcut = combo));
        })
        .catch(() => toast(t('settings.adhan.shortcutTaken'), 'warning'));
      setRecording(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [recording, t, update]);
  const label = shortcut ? shortcut.replace('CommandOrControl', 'Ctrl').split('+') : null;
  return (
    <div className="flex items-center gap-2">
      <span className="flex min-w-[9rem] items-center gap-1" dir="ltr">
        {recording ? <span className="text-[0.875rem] text-ochre-strong">{t('settings.adhan.recording')}</span> : label ? label.map((k) => <Kbd key={k}>{k}</Kbd>) : <span className="text-ink-muted">{t('settings.adhan.shortcutDisabled')}</span>}
      </span>
      <Button size="sm" variant="secondary" onClick={() => setRecording(true)}>
        {t('settings.adhan.recordShortcut')}
      </Button>
      {shortcut ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            void api.setShortcut(null);
            update((d) => void (d.adhan.stopShortcut = null));
          }}
        >
          {t('settings.adhan.disableShortcut')}
        </Button>
      ) : null}
    </div>
  );
}

export default function Adhan() {
  const f = useFmt();
  const { t } = f;
  const adhan = useS((s) => s.adhan);
  const update = useUpdate();
  const sounds = useSounds();
  const reload = usePrayer((s) => s.reloadSounds);
  const [importing, setImporting] = useState<{ path: string; name: string; isFajr: boolean } | null>(null);

  const addCustom = async () => {
    const path = await pickFilePath(['mp3', 'ogg', 'oga', 'flac', 'wav', 'm4a', 'aac']);
    if (!path) {
      if (!IS_TAURI) toast(t('errors.generic'), 'warning');
      return;
    }
    const base = path.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? '';
    setImporting({ path, name: base, isFajr: /fajr|فجر/i.test(base) });
  };

  return (
    <>
      <Group title={t('settings.adhan.perPrayer')}>
        <div id="settings.adhan.perPrayer" className="divide-y divide-line-soft">
          {ADHAN_PRAYERS.map((p) => (
            <PrayerRow key={p} p={p} />
          ))}
        </div>
      </Group>

      <Group>
        <Row k="settings.adhan.fajrSound" stacked>
          <div className="flex items-center gap-2">
            <SoundSelect
              fajr
              label={t('settings.adhan.fajrSound')}
              value={adhan.fajrSound}
              onChange={(v) =>
                update((d) => {
                  d.adhan.fajrSound = v;
                  d.adhan.perPrayer.fajr.sound = v;
                })
              }
            />
            <PreviewButton sound={adhan.fajrSound} volume={adhan.perPrayer.fajr.volume} />
          </div>
        </Row>
        <Row k="settings.adhan.sounds" stacked>
          <ul className="divide-y divide-line-soft">
            {sounds.map((s) => (
              <SoundRow key={s.id} s={s} />
            ))}
          </ul>
          <div className="mt-2">
            <Button variant="soft" size="sm" icon={<IconPlus size={16} />} onClick={addCustom}>
              {t('settings.adhan.addCustom')}
            </Button>
            <p className="mt-1.5 text-[0.8125rem] text-ink-muted">{t('settings.adhan.addCustomDesc')}</p>
          </div>
        </Row>
      </Group>

      <Group>
        <Row k="settings.adhan.shortcut">
          <ShortcutRecorder />
        </Row>
        <Row k="settings.adhan.toastPosition">
          <Select
            label={t('settings.adhan.toastPosition')}
            value={adhan.toastPosition}
            onChange={(v) => update((d) => void (d.adhan.toastPosition = v))}
            className="w-52"
            options={[
              { value: 'auto', label: t('settings.adhan.toastAuto') },
              { value: 'bottom-end', label: t('settings.adhan.toastBottomEnd') },
              { value: 'top-end', label: t('settings.adhan.toastTopEnd') },
            ]}
          />
        </Row>
        <Row k="settings.adhan.toastAutoHide">
          <NumberField label={t('settings.adhan.toastAutoHide')} value={adhan.toastAutoHideSeconds} min={5} max={600} suffix={t('common.secUnit')} onChange={(v) => update((d) => void (d.adhan.toastAutoHideSeconds = v ?? 60))} />
        </Row>
        <Row k="settings.adhan.missed">
          <NumberField label={t('settings.adhan.missed')} value={adhan.missedGraceMinutes} min={0} max={30} suffix={t('common.minUnit')} onChange={(v) => update((d) => void (d.adhan.missedGraceMinutes = v ?? 3))} />
        </Row>
        <Row k="settings.adhan.fullscreen">
          <Toggle checked={adhan.muteWhenFullscreen} onChange={(v) => update((d) => void (d.adhan.muteWhenFullscreen = v))} label={t('settings.adhan.fullscreen')} />
        </Row>
        <Row k="settings.adhan.dnd">
          <Toggle checked={adhan.respectDnd} onChange={(v) => update((d) => void (d.adhan.respectDnd = v))} label={t('settings.adhan.dnd')} />
        </Row>
        <Row k="settings.adhan.test">
          <Button variant="secondary" icon={<IconPlay size={15} />} onClick={() => void api.testAdhan('dhuhr')}>
            {t('settings.adhan.test')}
          </Button>
        </Row>
      </Group>

      <Dialog
        open={importing !== null}
        onClose={() => setImporting(null)}
        title={t('settings.adhan.addCustom')}
        closeLabel={t('common.close')}
        footer={
          <Button
            variant="primary"
            onClick={async () => {
              if (!importing) return;
              try {
                await api.importAdhan(importing.path, importing.name.trim() || 'Adhan', importing.isFajr);
                await reload();
                toast(t('common.saved'), 'success');
              } catch (e) {
                const msg = String(e);
                toast(
                  msg.includes('too_large') ? t('settings.adhan.tooLarge') : msg.includes('not_audio') ? t('settings.adhan.notAudio') : t('settings.adhan.importError', { message: msg }),
                  'error',
                );
              }
              setImporting(null);
            }}
          >
            {t('common.import')}
          </Button>
        }
      >
        {importing ? (
          <div className="flex flex-col gap-4 pb-2">
            <TextInput label={t('common.rename')} value={importing.name} onChange={(e) => setImporting({ ...importing, name: e.target.value })} />
            <Checkbox checked={importing.isFajr} onChange={(v) => setImporting({ ...importing, isFajr: v })} label={t('settings.adhan.isFajr')} />
          </div>
        ) : null}
      </Dialog>
      <ResetSection keys={['adhan']} />
    </>
  );
}
