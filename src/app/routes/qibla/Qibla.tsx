import { lazy, Suspense, useMemo, useState } from 'react';
import { DateTime } from 'luxon';
import { useFmt } from '@/lib/useFmt';
import { useS } from '@/features/settings/store';
import { usePrayer } from '@/features/prayer/store';
import { useNowMinute } from '@/lib/clock';
import { placeName } from '@/features/location/search';
import { declination, distanceKm, qiblaBearing, rasdAlQibla, sunAlignments, sunPosition } from '@/features/qibla/qibla';
import { Button, EmptyState } from '@/design/components';
import { IconMap, IconQibla, IconSun } from '@/design/icons';

const QiblaMap = lazy(() => import('./QiblaMap'));

function Compass({ bearing, sunAz, sunUp, label }: { bearing: number; sunAz: number; sunUp: boolean; label: string }) {
  const f = useFmt();
  const ticks = Array.from({ length: 72 }, (_, i) => i * 5);
  const card = f.lang === 'ar' ? ['ش', 'ق', 'ج', 'غ'] : ['N', 'E', 'S', 'W'];
  return (
    <svg viewBox="-160 -160 320 320" className="h-full w-full" role="img" aria-label={label}>
      <circle r="150" fill="var(--surface-raised)" stroke="var(--line)" />
      <circle r="118" fill="none" stroke="var(--line-soft)" />
      {ticks.map((a) => (
        <line
          key={a}
          x1="0"
          y1={-150}
          x2="0"
          y2={a % 90 === 0 ? -134 : a % 30 === 0 ? -140 : -145}
          stroke={a % 90 === 0 ? 'var(--ink)' : 'var(--ink-faint)'}
          strokeWidth={a % 30 === 0 ? 1.6 : 0.8}
          transform={`rotate(${a})`}
        />
      ))}
      {card.map((c, i) => {
        const a = (i * Math.PI) / 2;
        return (
          <text key={c} x={Math.sin(a) * 102} y={-Math.cos(a) * 102} textAnchor="middle" dominantBaseline="central" className="font-display" fill={i === 0 ? 'var(--danger)' : 'var(--ink-muted)'} style={{ fontSize: 17 }}>
            {c}
          </text>
        );
      })}
      {sunUp ? (
        <g transform={`rotate(${sunAz})`}>
          <circle cy="-126" r="7" fill="#E7C987" stroke="#FBF1D2" strokeWidth="1.5" />
        </g>
      ) : null}
      <g transform={`rotate(${bearing})`}>
        <line x1="0" y1="18" x2="0" y2="-88" stroke="var(--sage-strong)" strokeWidth="4" strokeLinecap="round" />
        <path d="M0 -100 L9 -82 L-9 -82 Z" fill="var(--sage-strong)" />
        <g transform="translate(0 -128)">
          <rect x="-10" y="-10" width="20" height="20" rx="2" fill="var(--ink)" />
          <rect x="-10" y="-5" width="20" height="3" fill="#C9A15B" />
        </g>
      </g>
      <circle r="7" fill="var(--sage-strong)" stroke="var(--surface)" strokeWidth="2" />
    </svg>
  );
}

export default function Qibla() {
  const f = useFmt();
  const { t } = f;
  const place = useS((s) => s.location.current);
  const mapAllowed = useS((s) => s.privacy.mapTiles);
  const engine = usePrayer((s) => s.engine);
  const now = useNowMinute();
  const hour = Math.floor(now / 3_600_000);
  const [showMap, setShowMap] = useState(false);

  const info = useMemo(() => {
    if (!place || !engine) return null;
    const bearing = qiblaBearing(place.lat, place.lon);
    const zone = engine.zone;
    const at = hour * 3_600_000;
    const dayStart = DateTime.fromMillis(at, { zone }).startOf('day').toMillis();
    return {
      bearing,
      km: distanceKm(place.lat, place.lon),
      aligns: sunAlignments(place.lat, place.lon, dayStart, dayStart + 86_400_000, bearing),
      rasd: rasdAlQibla(at, 2),
      decl: declination(place.lat, place.lon, new Date(at)),
      zone,
    };
  }, [place, engine, hour]);

  if (!place || !engine || !info) return <EmptyState icon={<IconQibla size={28} />} title={t('home.noLocationTitle')} body={t('home.noLocationBody')} />;
  const sun = sunPosition(place.lat, place.lon, new Date(now));
  const deg = (v: number) => f.ltr(`${f.num(v.toFixed(1))}°`);
  const magnetic = info.decl !== null ? (info.bearing - info.decl + 360) % 360 : null;

  return (
    <div className="mx-auto max-w-[1080px] px-6 pt-5 pb-10">
      <h1 className="font-display mb-5 text-[1.75rem] text-ink">{t('qibla.title')}</h1>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section className="flex flex-col items-center rounded-hero border border-line-soft bg-surface p-6 shadow-sm">
          <div className="aspect-square w-full max-w-[340px]">
            <Compass bearing={info.bearing} sunAz={sun.azimuth} sunUp={sun.altitude > 0} label={t('qibla.compassLabel', { degrees: deg(info.bearing) })} />
          </div>
          <div className="mt-4 text-center">
            <bdi dir="ltr" className="tabular text-[2.5rem] leading-none font-medium text-sage-strong">
              {deg(info.bearing)}
            </bdi>
            <p className="mt-1 text-ink-muted">{t('qibla.fromNorth')}</p>
            <p className="mt-3 text-[0.9375rem] text-ink">{t('qibla.distance', { km: f.num(Math.round(info.km).toLocaleString('en-US')), place: placeName(place, f.lang) })}</p>
          </div>
        </section>

        <div className="flex flex-col gap-4">
          <p className="text-ink-muted">{t('qibla.noCompass')}</p>
          <section className="rounded-panel border border-line-soft bg-surface p-5">
            <h2 className="mb-1 flex items-center gap-2 font-semibold text-ink">
              <IconSun size={18} className="text-ochre" />
              {t('qibla.sunTitle')}
            </h2>
            <p className="mb-3 text-[0.875rem] text-ink-muted">{t('qibla.sunBody')}</p>
            {info.aligns.length ? (
              <ul className="flex flex-col gap-2">
                {info.aligns.map((a) => (
                  <li key={a.at} className="flex items-center gap-3 rounded-[10px] bg-surface-sunk px-3 py-2">
                    <bdi dir="ltr" className="tabular text-[1.125rem] font-semibold text-ink">
                      {f.time(a.at, info.zone)}
                    </bdi>
                    <span className="text-ink">{a.kind === 'facing' ? t('qibla.faceSun') : t('qibla.backToSun')}</span>
                    {a.at < now ? <span className="ms-auto text-[0.8125rem] text-ink-faint">{t('home.passed')}</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[0.9375rem] text-ink-muted">{t('qibla.noSunToday')}</p>
            )}
          </section>
          <section className="rounded-panel border border-line-soft bg-surface p-5">
            <h2 className="mb-1 font-semibold text-ink">{t('qibla.rasdTitle')}</h2>
            <p className="mb-3 text-[0.875rem] text-ink-muted">{t('qibla.rasdBody')}</p>
            <ul className="flex flex-col gap-1.5">
              {info.rasd.map((r) => (
                <li key={r.at} className="flex items-center gap-3">
                  <span className="text-ink">{f.gregorian(DateTime.fromMillis(r.at, { zone: info.zone }).toISODate()!, { weekday: true })}</span>
                  <bdi dir="ltr" className="tabular font-semibold text-sage-strong">
                    {f.time(r.at, info.zone)}
                  </bdi>
                </li>
              ))}
            </ul>
          </section>
          {magnetic !== null && info.decl !== null ? (
            <section className="rounded-panel border border-line-soft bg-surface p-5">
              <h2 className="mb-1 font-semibold text-ink">{t('qibla.phoneTitle')}</h2>
              <p className="text-[0.9375rem] text-ink-muted">
                {t(info.decl >= 0 ? 'qibla.declEast' : 'qibla.declWest', { degrees: deg(Math.abs(info.decl)) })} {t('qibla.phoneBody', { degrees: deg(magnetic) })}
              </p>
            </section>
          ) : null}
          {mapAllowed ? (
            showMap ? (
              <Suspense fallback={<div className="h-72 rounded-panel bg-surface-sunk" />}>
                <QiblaMap lat={place.lat} lon={place.lon} />
              </Suspense>
            ) : (
              <Button variant="secondary" icon={<IconMap size={18} />} onClick={() => setShowMap(true)}>
                {t('qibla.showMap')}
              </Button>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
