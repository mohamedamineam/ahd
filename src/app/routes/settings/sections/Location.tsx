import { useEffect, useMemo, useState } from 'react';
import { DateTime, IANAZone } from 'luxon';
import clsx from 'clsx';
import { useFmt } from '@/lib/useFmt';
import { useS } from '@/features/settings/store';
import { useLocations } from '@/features/location/useLocations';
import { LocationPicker } from '@/features/location/LocationPicker';
import { placeName, placeSubtitle } from '@/features/location/search';
import { resolveZone } from '@/features/prayer/engine';
import { Button, Dialog, IconButton, NumberField, Segmented, Select, TextInput, Toggle } from '@/design/components';
import { IconCheck, IconEdit, IconPin, IconTrash } from '@/design/icons';
import { Group, ResetSection, Row, useUpdate } from './shared';

function offsetLabel(minutes: number) {
  const sign = minutes < 0 ? '−' : '+';
  const a = Math.abs(minutes);
  return `UTC${sign}${Math.floor(a / 60)}${a % 60 ? `:${String(a % 60).padStart(2, '0')}` : ''}`;
}

function nextTransition(zone: string): { at: DateTime; offset: number } | null {
  if (!IANAZone.isValidZone(zone)) return null;
  let prev = DateTime.now().setZone(zone);
  for (let i = 1; i <= 400; i++) {
    const cur = prev.plus({ days: 1 });
    if (cur.offset !== prev.offset) {
      // refine to the hour
      let lo = prev;
      for (let h = 1; h <= 24; h++) {
        const x = prev.plus({ hours: h });
        if (x.offset !== prev.offset) return { at: x.startOf('hour'), offset: x.offset };
        lo = x;
      }
      return { at: lo, offset: cur.offset };
    }
    prev = cur;
  }
  return null;
}

export default function LocationSection() {
  const f = useFmt();
  const { t, lang } = f;
  const loc = useS((s) => s.location);
  const update = useUpdate();
  const { saved, load, choose, rename, remove } = useLocations();
  const [picking, setPicking] = useState(false);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  useEffect(() => {
    void load();
  }, [load]);

  const zones = useMemo(() => {
    try {
      return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf('timeZone');
    } catch {
      return ['UTC'];
    }
  }, []);

  const zone = loc.current ? resolveZone(loc.current, loc.tz) : 'UTC';
  const now = DateTime.now().setZone(zone);
  const transition = loc.tz.kind === 'fixed' ? null : nextTransition(zone);

  return (
    <>
      <Group>
        <Row k="settings.location.current" stacked>
          <div className="flex flex-wrap items-center gap-4">
            {loc.current ? (
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sage-soft text-sage-strong">
                  <IconPin size={19} />
                </span>
                <div className="min-w-0">
                  <div className="truncate font-semibold text-ink">{placeName(loc.current, lang)}</div>
                  <div className="truncate text-[0.875rem] text-ink-muted">
                    {placeSubtitle(loc.current, lang)} —{' '}
                    <bdi dir="ltr" className="tabular">
                      {f.ltr(`${f.num(loc.current.lat.toFixed(4))}, ${f.num(loc.current.lon.toFixed(4))}`)}
                    </bdi>
                  </div>
                </div>
              </div>
            ) : null}
            <Button variant="primary" onClick={() => setPicking(true)}>
              {t('settings.location.change')}
            </Button>
          </div>
        </Row>
        <Row k="settings.location.saved" stacked>
          <ul className="flex flex-col gap-1">
            {saved.map((l) => {
              const active = l.place.id === loc.current?.id;
              return (
                <li key={l.id} className={clsx('flex items-center gap-3 rounded-[10px] px-3 py-2', active ? 'bg-sage-soft' : 'bg-surface-raised')}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink">{l.name || placeName(l.place, lang)}</span>
                    <span className="block truncate text-[0.8125rem] text-ink-muted">{placeSubtitle(l.place, lang)}</span>
                  </span>
                  {active ? (
                    <IconCheck size={17} className="text-sage-strong" />
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => void choose(l.place)}>
                      {t('settings.location.switchTo')}
                    </Button>
                  )}
                  <IconButton size="sm" label={t('common.rename')} onClick={() => setRenaming({ id: l.id, name: l.name || placeName(l.place, lang) })}>
                    <IconEdit size={16} />
                  </IconButton>
                  <IconButton size="sm" label={t('common.delete')} disabled={active} onClick={() => void remove(l.id)}>
                    <IconTrash size={16} />
                  </IconButton>
                </li>
              );
            })}
          </ul>
        </Row>
      </Group>

      <Group>
        <Row k="settings.location.timezone" stacked>
          <div className="flex flex-col gap-3">
            <Segmented
              label={t('settings.location.timezone')}
              value={loc.tz.kind}
              onChange={(k) =>
                update((d) => {
                  d.location.tz =
                    k === 'auto' ? { kind: 'auto' } : k === 'iana' ? { kind: 'iana', zone: zone } : { kind: 'fixed', offsetMinutes: now.offset, dst: false };
                })
              }
              options={[
                { value: 'auto', label: t('settings.location.tzAuto') },
                { value: 'iana', label: t('settings.location.tzIana') },
                { value: 'fixed', label: t('settings.location.tzFixed') },
              ]}
            />
            {loc.tz.kind === 'iana' ? (
              <Select
                label={t('settings.location.searchZone')}
                value={loc.tz.zone}
                onChange={(v) => update((d) => void (d.location.tz = { kind: 'iana', zone: v }))}
                className="w-96 max-w-full"
                options={zones.map((z) => ({ value: z, label: z.replace(/_/g, ' '), hint: offsetLabel(DateTime.now().setZone(z).offset) }))}
              />
            ) : null}
            {loc.tz.kind === 'fixed' ? (
              <div className="flex flex-wrap items-center gap-4">
                <Select
                  label={t('settings.location.utcOffset')}
                  value={String(loc.tz.offsetMinutes)}
                  onChange={(v) => update((d) => void (d.location.tz = { kind: 'fixed', offsetMinutes: Number(v), dst: loc.tz.kind === 'fixed' && loc.tz.dst }))}
                  className="w-44"
                  options={Array.from({ length: 105 }, (_, i) => -720 + i * 15).map((m) => ({ value: String(m), label: offsetLabel(m) }))}
                />
                <label className="flex items-center gap-2">
                  <Toggle
                    checked={loc.tz.dst}
                    onChange={(v) => update((d) => void (d.location.tz = { kind: 'fixed', offsetMinutes: loc.tz.kind === 'fixed' ? loc.tz.offsetMinutes : 0, dst: v }))}
                    label={t('settings.location.dst')}
                  />
                  <span className="text-ink">{t('settings.location.dst')}</span>
                </label>
              </div>
            ) : null}
            <p className="text-[0.875rem] text-ink-muted">
              <bdi dir="ltr">{zone}</bdi> — {t('settings.location.currentOffset', { offset: offsetLabel(now.offset) })}
              {loc.tz.kind !== 'fixed' ? (
                <>
                  {' — '}
                  {transition
                    ? t('settings.location.nextTransition', { date: f.gregorian(transition.at.toISODate()!), offset: offsetLabel(transition.offset) })
                    : t('settings.location.noTransition')}
                </>
              ) : null}
            </p>
          </div>
        </Row>
        <Row k="settings.location.elevation">
          <NumberField
            label={t('settings.location.elevation')}
            value={loc.current?.elevation ?? null}
            min={-500}
            max={9000}
            suffix="m"
            onChange={(v) =>
              update((d) => {
                if (d.location.current) d.location.current.elevation = v ?? undefined;
              })
            }
          />
        </Row>
      </Group>

      <Dialog open={picking} onClose={() => setPicking(false)} title={t('settings.location.change')} size="lg" closeLabel={t('common.close')}>
        <div className="pb-3">
          <LocationPicker
            autoFocus
            selected={loc.current}
            onPick={(p) => {
              void choose(p);
              setPicking(false);
            }}
          />
        </div>
      </Dialog>
      <Dialog
        open={renaming !== null}
        onClose={() => setRenaming(null)}
        title={t('settings.location.renamePrompt')}
        size="sm"
        closeLabel={t('common.close')}
        footer={
          <Button
            variant="primary"
            onClick={() => {
              if (renaming) void rename(renaming.id, renaming.name.trim());
              setRenaming(null);
            }}
          >
            {t('common.save')}
          </Button>
        }
      >
        <TextInput autoFocus value={renaming?.name ?? ''} onChange={(e) => setRenaming((r) => (r ? { ...r, name: e.target.value } : r))} aria-label={t('settings.location.renamePrompt')} />
      </Dialog>
      <ResetSection keys={['location']} onReset={(d) => void (d.location.tz = { kind: 'auto' })} />
    </>
  );
}
