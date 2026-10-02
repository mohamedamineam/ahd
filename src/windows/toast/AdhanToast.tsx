import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, listen } from '@/lib/bridge';
import { useAudio } from '@/app/shell/AdhanPlayingPill';
import { AhdMark } from '@/design/brand/AhdMark';
import { IconClose, IconStop } from '@/design/icons';
import { useDuaAfterAdhan } from '@/features/adhkar/data';
import { ShapedText } from '@/features/shaping/ShapedText';
import { useAuxWindow } from '../shared';

interface ToastPayload {
  prayer: string;
  prayerLabel: string;
  at: number;
  title: string;
  body: string;
  location: string;
  timeText: string;
  autoHideSeconds: number;
  audible: boolean;
}

/** Adhan toast (brief §10.3): closing it only hides it — the adhan keeps playing until it ends or Stop. */
export default function AdhanToast() {
  useAuxWindow();
  const { t, i18n } = useTranslation();
  const audio = useAudio();
  const [p, setP] = useState<ToastPayload | null>(null);
  // the dua after the adhan: shown once the adhan has ended, or earlier on click
  const [expanded, setExpanded] = useState(false);
  const dua = useDuaAfterAdhan();
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    const un = listen<ToastPayload>('ahd://toast', (payload) => {
      setP(payload);
      setExpanded(false);
    });
    // the window may have been created for this adhan after the event was sent
    void api
      .toastPayload<ToastPayload>()
      .then((payload) => alive && payload && setP((cur) => cur ?? payload))
      .catch(() => {});
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 's' || e.key === 'S') void api.toastAction('stop');
    };
    window.addEventListener('keydown', onKey);
    return () => {
      alive = false;
      void un.then((f) => f());
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  // after the adhan ends: show the dua after the adhan, then auto-hide
  useEffect(() => {
    if (!p) return;
    if (!audio.playing) {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => void api.toastAction('hide'), Math.max(5, p.autoHideSeconds) * 1000);
    } else if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, [audio.playing, p]);

  const playing = audio.playing && audio.kind === 'adhan';
  // the dua after the adhan appears as soon as the adhan has ended (or on click while it plays)
  const showDua = expanded || (p !== null && !audio.playing);

  // the window takes the height of its content: compact during the adhan, taller with the dua
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = card.current;
    if (!el) return;
    let last = 0;
    const ro = new ResizeObserver(() => {
      const h = Math.ceil(el.getBoundingClientRect().height) + 16; // + the p-2 margin around the card
      if (Math.abs(h - last) > 2) {
        last = h;
        void api.fitToast(h).catch(() => {});
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="w-screen p-2">
      <div ref={card} className="khatam relative flex flex-col overflow-hidden rounded-[18px] border border-line-soft bg-surface shadow-lg" onClick={() => setExpanded(true)}>
        <button
          type="button"
          aria-label={t('toast.close')}
          title={t('toast.close')}
          onClick={(e) => {
            e.stopPropagation();
            void api.toastAction('hide');
          }}
          className="absolute end-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-ink-muted hover:bg-surface-sunk"
        >
          <IconClose size={16} />
        </button>
        <div className="flex items-center gap-3 px-5 pt-4">
          <AhdMark size={34} />
          <div className="min-w-0 flex-1">
            <div className="font-display text-[1.5rem] leading-tight text-ink">{p?.prayerLabel}</div>
            <div className="truncate text-[0.8125rem] text-ink-muted">
              {p?.timeText ? (
                <>
                  <bdi dir="ltr" className="tabular">
                    {p.timeText}
                  </bdi>
                  {p.location ? ' — ' : null}
                </>
              ) : null}
              {p?.location}
            </div>
          </div>
        </div>
        {showDua && dua ? (
          <div className="animate-fade-in mx-5 mt-3 border-t border-line-soft pt-2.5">
            <p className="mb-1 text-[0.75rem] font-medium text-sage-strong">{t('toast.dua')}</p>
            <ShapedText font="amiri" text={dua.text} size={16} lineHeight={1.8} className="text-ink" fallbackClassName="font-dhikr" />
            {i18n.language === 'en' && dua.en ? (
              // the dua itself; the glossary that follows it in the book's translation is left for the adhkar page
              <p lang="en" dir="ltr" title={dua.en} className="mt-1 line-clamp-5 text-[0.8125rem] leading-snug text-ink-muted">
                {dua.en}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="mt-3 flex items-center gap-2 px-4 pb-3">
          {playing ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void api.toastAction('stop');
              }}
              className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-full bg-sage-strong text-[0.875rem] font-medium text-on-sage active:scale-95"
            >
              <IconStop size={14} />
              {t('toast.stop')} <kbd className="rounded bg-white/15 px-1 text-[0.6875rem]">S</kbd>
            </button>
          ) : (
            <span className="flex-1 text-[0.8125rem] text-ink-muted">{t('toast.ended')}</span>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void api.toastAction('open');
            }}
            className="inline-flex h-9 items-center rounded-full border border-line bg-surface-raised px-4 text-[0.875rem] font-medium text-ink"
          >
            {t('toast.openApp')}
          </button>
        </div>
      </div>
    </div>
  );
}
