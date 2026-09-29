import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { useFmt } from '@/lib/useFmt';
import { useS } from '@/features/settings/store';
import { Button, TextInput, Spinner, Badge } from '@/design/components';
import { IconCrosshair, IconGlobe, IconMap, IconPin, IconSearch, IconClose } from '@/design/icons';
import type { Place } from '@/features/prayer/types';
import { detectPosition, placeFromCoordinates, placeName, placeSubtitle, searchOffline, searchOnline } from './search';

const MapPicker = lazy(() => import('./MapPicker'));

export interface LocationPickerProps {
  onPick: (place: Place) => void;
  selected?: Place | null;
  autoFocus?: boolean;
}

export function LocationPicker({ onPick, selected, autoFocus }: LocationPickerProps) {
  const f = useFmt();
  const { t, lang } = f;
  const privacy = useS((s) => s.privacy);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [online, setOnline] = useState<Place[] | null>(null);
  const [busy, setBusy] = useState<'online' | 'detect' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'search' | 'manual' | 'map'>('search');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const seq = useRef(0);

  useEffect(() => {
    const id = ++seq.current;
    const h = setTimeout(async () => {
      const r = await searchOffline(query).catch(() => []);
      if (id === seq.current) {
        setResults(r);
        setOnline(null);
      }
    }, 120);
    return () => clearTimeout(h);
  }, [query]);

  const doOnline = async () => {
    if (!privacy.placeSearch) {
      setError(t('errors.networkDisabled'));
      return;
    }
    setBusy('online');
    setError(null);
    try {
      setOnline(await searchOnline(query, lang));
    } catch {
      setError(t('errors.offline'));
    } finally {
      setBusy(null);
    }
  };

  const doDetect = async () => {
    setBusy('detect');
    setError(null);
    try {
      const p = await detectPosition();
      onPick(await placeFromCoordinates(p.lat, p.lon, 'detected'));
    } catch {
      setError(t('onboarding.location.detectFailed'));
    } finally {
      setBusy(null);
    }
  };

  const useManual = async () => {
    const la = Number(lat.replace(',', '.'));
    const lo = Number(lon.replace(',', '.'));
    if (!Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180 || lat === '' || lon === '') {
      setError(t('onboarding.location.invalidCoordinates'));
      return;
    }
    setError(null);
    onPick(await placeFromCoordinates(la, lo, 'manual'));
  };

  const row = (p: Place) => {
    const active = selected?.id === p.id;
    return (
      <li key={p.id}>
        <button
          type="button"
          onClick={() => onPick(p)}
          className={clsx(
            'flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-start transition-colors',
            active ? 'bg-sage-soft' : 'hover:bg-[color-mix(in_oklab,var(--ink)_5%,transparent)]',
          )}
        >
          <span className={clsx('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', active ? 'bg-sage-strong text-on-sage' : 'bg-surface-sunk text-ink-muted')}>
            <IconPin size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-ink">{placeName(p, lang)}</span>
            <span className="block truncate text-[0.8125rem] text-ink-muted">{placeSubtitle(p, lang)}</span>
          </span>
          {p.source === 'nominatim' ? <Badge tone="outline">OSM</Badge> : null}
        </button>
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1 basis-72">
          <TextInput
            autoFocus={autoFocus}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && query.trim().length >= 2) void doOnline();
            }}
            placeholder={t('onboarding.location.placeholder')}
            aria-label={t('onboarding.location.placeholder')}
            leading={<IconSearch size={18} className="text-ink-faint" />}
            trailing={
              query ? (
                <button type="button" aria-label={t('common.clear')} onClick={() => setQuery('')} className="text-ink-faint hover:text-ink">
                  <IconClose size={16} />
                </button>
              ) : null
            }
          />
        </div>
        <Button variant="secondary" icon={busy === 'online' ? <Spinner /> : <IconGlobe size={18} />} disabled={query.trim().length < 2 || busy !== null} onClick={doOnline}>
          {t('onboarding.location.searchOnline')}
        </Button>
      </div>

      {mode === 'search' ? (
        <div className="min-h-[11rem]">
          {results.length ? (
            <>
              <p className="mb-1 px-1 text-[0.8125rem] text-ink-faint">{t('onboarding.location.offlineResults')}</p>
              <ul className="flex flex-col gap-0.5">{results.map(row)}</ul>
            </>
          ) : query.trim().length >= 2 && !online ? (
            <p className="px-1 py-6 text-center text-ink-muted">{t('onboarding.location.noResults')}</p>
          ) : null}
          {online ? (
            <div className="mt-3">
              <p className="mb-1 px-1 text-[0.8125rem] text-ink-faint">{t('onboarding.location.onlineResults')}</p>
              {online.length ? <ul className="flex flex-col gap-0.5">{online.map(row)}</ul> : <p className="px-1 py-3 text-ink-muted">{t('onboarding.location.noResults')}</p>}
              <p className="mt-2 px-1 text-[0.75rem] text-ink-faint">{t('onboarding.location.osm')}</p>
            </div>
          ) : (
            <p className="mt-3 px-1 text-[0.8125rem] text-ink-faint">{t('onboarding.location.searchOnlineHint')}</p>
          )}
        </div>
      ) : null}

      {mode === 'manual' ? (
        <div className="flex flex-wrap items-end gap-3">
          <TextInput label={t('onboarding.location.latitude')} inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} className="w-40" placeholder="36.1911" />
          <TextInput label={t('onboarding.location.longitude')} inputMode="decimal" value={lon} onChange={(e) => setLon(e.target.value)} className="w-40" placeholder="5.4137" />
          <Button variant="primary" onClick={useManual}>
            {t('onboarding.location.useCoordinates')}
          </Button>
        </div>
      ) : null}

      {mode === 'map' ? (
        <Suspense fallback={<div className="h-72 rounded-[12px] bg-surface-sunk" />}>
          <MapPicker
            initial={selected ?? null}
            onPick={async (la, lo) => onPick(await placeFromCoordinates(la, lo, 'manual'))}
          />
          <p className="mt-2 text-[0.8125rem] text-ink-muted">{t('onboarding.location.mapHint')}</p>
        </Suspense>
      ) : null}

      {error ? <p className="text-[0.875rem] text-danger">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-line-soft pt-3">
        <Button size="sm" variant="ghost" icon={busy === 'detect' ? <Spinner /> : <IconCrosshair size={17} />} onClick={doDetect} disabled={busy !== null} title={t('onboarding.location.detectHint')}>
          {t('onboarding.location.detect')}
        </Button>
        <Button size="sm" variant={mode === 'manual' ? 'soft' : 'ghost'} icon={<IconPin size={17} />} onClick={() => setMode(mode === 'manual' ? 'search' : 'manual')}>
          {t('onboarding.location.manual')}
        </Button>
        {privacy.mapTiles ? (
          <Button size="sm" variant={mode === 'map' ? 'soft' : 'ghost'} icon={<IconMap size={17} />} onClick={() => setMode(mode === 'map' ? 'search' : 'map')}>
            {t('onboarding.location.map')}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
