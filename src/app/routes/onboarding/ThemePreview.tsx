import { paletteTokens, type ThemeMode } from '@/design/palette';
import { useS } from '@/features/settings/store';

function Mini({ mode, clip }: { mode: ThemeMode; clip?: 'start' | 'end' }) {
  const palette = useS((s) => s.appearance.palette);
  const custom = useS((s) => s.appearance.custom);
  const c = paletteTokens(palette, mode, custom);
  const style = clip ? { clipPath: clip === 'start' ? 'polygon(0 0, 100% 0, 0 100%)' : 'polygon(100% 0, 100% 100%, 0 100%)' } : undefined;
  return (
    <svg viewBox="0 0 160 100" className="absolute inset-0 h-full w-full" style={style} aria-hidden>
      <rect width="160" height="100" fill={c.bg} />
      <rect x="0" y="0" width="22" height="100" fill={c.bg} stroke={c.line} strokeWidth="0.6" />
      <rect x="5" y="10" width="12" height="7" rx="3.5" fill={c['sage-soft']} />
      <rect x="7" y="24" width="8" height="2" rx="1" fill={c['ink-muted']} opacity=".5" />
      <rect x="7" y="32" width="8" height="2" rx="1" fill={c['ink-muted']} opacity=".5" />
      <rect x="30" y="10" width="122" height="48" rx="7" fill={c.surface} stroke={c.line} strokeWidth="0.6" />
      <path d="M52 50 A40 30 0 0 1 132 50" fill="none" stroke={c.sand} strokeWidth="1.6" />
      <path d="M52 50 A40 30 0 0 1 102 21.5" fill="none" stroke={c['sage-strong']} strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="102" cy="21.5" r="3.4" fill="#E0C07F" />
      <rect x="78" y="34" width="28" height="6" rx="2" fill={c['sage-strong']} />
      <rect x="30" y="64" width="122" height="30" rx="7" fill={c.surface} stroke={c.line} strokeWidth="0.6" />
      <rect x="36" y="70" width="110" height="8" rx="3" fill={c['sage-soft']} />
      <rect x="40" y="72.5" width="18" height="3" rx="1.5" fill={c.ink} opacity=".7" />
      <rect x="40" y="83" width="18" height="3" rx="1.5" fill={c['ink-muted']} opacity=".6" />
      <rect x="120" y="72.5" width="20" height="3" rx="1.5" fill={c.ink} opacity=".7" />
    </svg>
  );
}

/** Small live preview of the app in a theme (onboarding step 4, Appearance settings). */
export function ThemePreview({ mode }: { mode: 'light' | 'dark' | 'system' }) {
  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[12px] border border-line-soft">
      {mode === 'system' ? (
        <>
          <Mini mode="light" clip="start" />
          <Mini mode="dark" clip="end" />
        </>
      ) : (
        <Mini mode={mode} />
      )}
    </div>
  );
}
