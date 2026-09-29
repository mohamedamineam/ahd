/* Ahd icon set — 24×24, 1.6 stroke, round joins, currentColor. Drawn for this app (GPL-3.0-or-later). */
import type { SVGProps } from 'react';

export type IconProps = SVGProps<SVGSVGElement> & { size?: number; title?: string };

function Svg({ size = 20, title, children, strokeWidth = 1.6, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/* ---------- navigation ---------- */

export const IconPrayer = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 17.5h18" />
    <path d="M5.5 17.5a6.5 6.5 0 0 1 13 0" />
    <circle cx="15.8" cy="11.9" r="1.7" fill="currentColor" stroke="none" />
    <path d="M12 6.2V4.6M6.9 8.3 5.8 7.2M17.1 8.3l1.1-1.1" />
    <path d="M7.5 20.5h9" opacity=".55" />
  </Svg>
);

export const IconQuran = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 7.2c-2.2-1.6-4.9-2-7.8-1.3v11.3c2.9-.7 5.6-.3 7.8 1.3 2.2-1.6 4.9-2 7.8-1.3V5.9c-2.9-.7-5.6-.3-7.8 1.3Z" />
    <path d="M12 7.2v11.3" />
    <path d="M8.5 21 12 18.6 15.5 21" />
  </Svg>
);

export const IconAdhkar = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.6c-3.9 0-6.8 2.9-6.8 6.6 0 3.3 2.4 5.8 5.4 6.4" opacity=".55" />
    <path d="M12 3.6c3.9 0 6.8 2.9 6.8 6.6 0 3.3-2.4 5.8-5.4 6.4" opacity=".55" />
    <circle cx="12" cy="3.6" r="1.25" fill="currentColor" stroke="none" />
    <circle cx="7.1" cy="5.6" r="1.25" fill="currentColor" stroke="none" />
    <circle cx="16.9" cy="5.6" r="1.25" fill="currentColor" stroke="none" />
    <circle cx="5.3" cy="10.3" r="1.25" fill="currentColor" stroke="none" />
    <circle cx="18.7" cy="10.3" r="1.25" fill="currentColor" stroke="none" />
    <circle cx="7.4" cy="14.8" r="1.25" fill="currentColor" stroke="none" />
    <circle cx="16.6" cy="14.8" r="1.25" fill="currentColor" stroke="none" />
    <path d="M12 16.8v2.2M10.6 21.2 12 19l1.4 2.2" />
    <circle cx="12" cy="16.9" r="1.1" />
  </Svg>
);

export const IconQibla = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.6" />
    <rect x="10.2" y="5.2" width="3.6" height="3.4" rx=".4" />
    <path d="M10.2 6.4h3.6" />
    <path d="m12 12.2-2 4.6 2-1.1 2 1.1-2-4.6Z" fill="currentColor" stroke="none" />
    <path d="M12 12.2V9.6" />
    <circle cx="12" cy="12.2" r=".9" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconLibrary = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="5" width="3.6" height="14" rx=".8" />
    <rect x="8.9" y="3.8" width="3.6" height="15.2" rx=".8" />
    <path d="m14.4 5.6 3.4-1 3.6 13.4-3.4 1Z" />
    <path d="M4 8h3.6M8.9 7.2h3.6M3 20.5h18" />
  </Svg>
);

export const IconSettings = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="2.9" />
    <path d="M12 2.8v2.1M12 19.1v2.1M21.2 12h-2.1M4.9 12H2.8M18.5 5.5 17 7M7 17l-1.5 1.5M18.5 18.5 17 17M7 7 5.5 5.5" />
    <circle cx="12" cy="12" r="6.6" />
  </Svg>
);

export const IconTimetable = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="15" rx="2.2" />
    <path d="M3.5 9.5h17M8 3v3.6M16 3v3.6" />
    <path d="M7.5 13h2M11 13h2M14.5 13h2M7.5 16.4h2M11 16.4h2" />
  </Svg>
);

/* ---------- general ---------- */

export const IconPlus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const IconMinus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h14" />
  </Svg>
);
export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="m5 12.5 4.3 4.3L19 7.2" />
  </Svg>
);
export const IconClose = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);
export const IconChevronDown = (p: IconProps) => (
  <Svg {...p}>
    <path d="m6 9.5 6 6 6-6" />
  </Svg>
);
export const IconChevronUp = (p: IconProps) => (
  <Svg {...p}>
    <path d="m6 14.5 6-6 6 6" />
  </Svg>
);
/** Points to the reading-direction start (left in LTR, right in RTL) — mirrored by CSS in RTL. */
export const IconChevronStart = (p: IconProps) => (
  <Svg {...p} className={`rtl:-scale-x-100 ${p.className ?? ''}`}>
    <path d="m14.5 6-6 6 6 6" />
  </Svg>
);
export const IconChevronEnd = (p: IconProps) => (
  <Svg {...p} className={`rtl:-scale-x-100 ${p.className ?? ''}`}>
    <path d="m9.5 6 6 6-6 6" />
  </Svg>
);
export const IconChevronLeft = (p: IconProps) => (
  <Svg {...p}>
    <path d="m14.5 6-6 6 6 6" />
  </Svg>
);
export const IconChevronRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="m9.5 6 6 6-6 6" />
  </Svg>
);
export const IconSearch = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.2" />
    <path d="m15.6 15.6 4.2 4.2" />
  </Svg>
);
export const IconBell = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6.2 16.5V11a5.8 5.8 0 0 1 11.6 0v5.5l1.5 1.7H4.7Z" />
    <path d="M10 20.3a2.2 2.2 0 0 0 4 0" />
  </Svg>
);
export const IconBellOff = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8.3 6.6A5.8 5.8 0 0 1 17.8 11v4" />
    <path d="M6.2 11v5.5l-1.5 1.7h12.8" />
    <path d="M10 20.3a2.2 2.2 0 0 0 4 0M4 4l16 16" />
  </Svg>
);
export const IconVolume = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 9.5h3l4.5-4v13l-4.5-4h-3Z" />
    <path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11" />
  </Svg>
);
export const IconPlay = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 5.5v13l10.5-6.5Z" fill="currentColor" />
  </Svg>
);
export const IconStop = (p: IconProps) => (
  <Svg {...p}>
    <rect x="6.5" y="6.5" width="11" height="11" rx="1.8" fill="currentColor" />
  </Svg>
);
export const IconPin = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 21s-6.3-5.6-6.3-11A6.3 6.3 0 0 1 18.3 10c0 5.4-6.3 11-6.3 11Z" />
    <circle cx="12" cy="10" r="2.3" />
  </Svg>
);
export const IconGlobe = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.4 2.6 3.6 5.4 3.6 8.5s-1.2 5.9-3.6 8.5c-2.4-2.6-3.6-5.4-3.6-8.5S9.6 6.1 12 3.5Z" />
  </Svg>
);
export const IconClock = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);
export const IconSun = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3.8" />
    <path d="M12 2.8v2M12 19.2v2M21.2 12h-2M4.8 12h-2M18.5 5.5l-1.4 1.4M6.9 17.1l-1.4 1.4M18.5 18.5l-1.4-1.4M6.9 6.9 5.5 5.5" />
  </Svg>
);
export const IconMoon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M19.5 14.2A7.8 7.8 0 1 1 9.8 4.5a6.2 6.2 0 0 0 9.7 9.7Z" />
  </Svg>
);
export const IconMonitor = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="17" height="11.5" rx="1.8" />
    <path d="M9 20h6M12 16v4" />
  </Svg>
);
export const IconDownload = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4v11M7.5 10.8 12 15.3l4.5-4.5M5 19.5h14" />
  </Svg>
);
export const IconUpload = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 15.5v-11M7.5 8.7 12 4.2l4.5 4.5M5 19.5h14" />
  </Svg>
);
export const IconTrash = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l.9 12.2h9.2L17.5 7M10.2 10.5v5.5M13.8 10.5v5.5" />
  </Svg>
);
export const IconEdit = (p: IconProps) => (
  <Svg {...p}>
    <path d="m15.5 5.2 3.3 3.3L9 18.3l-4 .7.7-4Z" />
    <path d="m13.6 7.1 3.3 3.3" />
  </Svg>
);
export const IconMore = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="6" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="18" cy="12" r="1.3" fill="currentColor" stroke="none" />
  </Svg>
);
export const IconInfo = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5.2M12 7.8v.1" />
  </Svg>
);
export const IconAlert = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10.3 4.6 3.4 17a2 2 0 0 0 1.7 3h13.8a2 2 0 0 0 1.7-3L13.7 4.6a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9.5v4.2M12 16.6v.1" />
  </Svg>
);
export const IconExternal = (p: IconProps) => (
  <Svg {...p}>
    <path d="M13.5 4.5h6v6M19.5 4.5l-8 8M18 13.8v4.4a1.8 1.8 0 0 1-1.8 1.8H5.8A1.8 1.8 0 0 1 4 18.2V7.8A1.8 1.8 0 0 1 5.8 6h4.4" />
  </Svg>
);
export const IconRefresh = (p: IconProps) => (
  <Svg {...p}>
    <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v3.8h-3.8" />
  </Svg>
);
export const IconBookmark = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 4h10v16.5l-5-3.6-5 3.6Z" />
  </Svg>
);
export const IconPrinter = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 8.5V4h10v4.5M7 16.5H5a1.5 1.5 0 0 1-1.5-1.5v-5A1.5 1.5 0 0 1 5 8.5h14a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5h-2" />
    <rect x="7" y="13.5" width="10" height="6.5" rx=".8" />
  </Svg>
);
export const IconFile = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 3.5H7.2A1.7 1.7 0 0 0 5.5 5.2v13.6a1.7 1.7 0 0 0 1.7 1.7h9.6a1.7 1.7 0 0 0 1.7-1.7V8Z" />
    <path d="M14 3.5V8h4.5M8.8 12.5h6.4M8.8 15.8h4.4" />
  </Svg>
);
export const IconWinMinimize = (p: IconProps) => (
  <Svg {...p} strokeWidth={1.3}>
    <path d="M6.5 12h11" />
  </Svg>
);
export const IconWinMaximize = (p: IconProps) => (
  <Svg {...p} strokeWidth={1.3}>
    <rect x="6.5" y="6.5" width="11" height="11" rx="1.2" />
  </Svg>
);
export const IconWinRestore = (p: IconProps) => (
  <Svg {...p} strokeWidth={1.3}>
    <rect x="6.5" y="8.8" width="8.7" height="8.7" rx="1.1" />
    <path d="M9 8.8V7.7A1.2 1.2 0 0 1 10.2 6.5h6.1a1.2 1.2 0 0 1 1.2 1.2v6.1a1.2 1.2 0 0 1-1.2 1.2h-1.1" />
  </Svg>
);
export const IconWinClose = (p: IconProps) => (
  <Svg {...p} strokeWidth={1.3}>
    <path d="m7 7 10 10M17 7 7 17" />
  </Svg>
);
export const IconKhatam = (p: IconProps) => (
  <Svg {...p}>
    <rect x="6.3" y="6.3" width="11.4" height="11.4" />
    <rect x="6.3" y="6.3" width="11.4" height="11.4" transform="rotate(45 12 12)" />
  </Svg>
);
export const IconCrosshair = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="6.8" />
    <circle cx="12" cy="12" r="1.8" />
    <path d="M12 2.8v2.6M12 18.6v2.6M21.2 12h-2.6M5.4 12H2.8" />
  </Svg>
);
export const IconMap = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 5 3.8 6.8v12.4L9 17.4l6 1.8 5.2-1.8V5L15 6.8Z" />
    <path d="M9 5v12.4M15 6.8v12.4" />
  </Svg>
);
export const IconList = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 6.5h11M9 12h11M9 17.5h11" />
    <circle cx="4.8" cy="6.5" r=".9" fill="currentColor" stroke="none" />
    <circle cx="4.8" cy="12" r=".9" fill="currentColor" stroke="none" />
    <circle cx="4.8" cy="17.5" r=".9" fill="currentColor" stroke="none" />
  </Svg>
);
export const IconGrid = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.4" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.4" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.4" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.4" />
  </Svg>
);
export const IconTextSize = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 18 8.5 6 13 18M5.7 14h5.6M15 18l2.8-7.5 2.8 7.5M15.9 15.6h3.8" />
  </Svg>
);
export const IconFocus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 9V5.8A1.3 1.3 0 0 1 5.8 4.5H9M15 4.5h3.2a1.3 1.3 0 0 1 1.3 1.3V9M19.5 15v3.2a1.3 1.3 0 0 1-1.3 1.3H15M9 19.5H5.8a1.3 1.3 0 0 1-1.3-1.3V15" />
  </Svg>
);
export const IconLayers = (p: IconProps) => (
  <Svg {...p}>
    <path d="m12 4 8.5 4.6L12 13.2 3.5 8.6Z" />
    <path d="m3.5 12.4 8.5 4.6 8.5-4.6M3.5 16.2l8.5 4.6 8.5-4.6" />
  </Svg>
);
export const IconKeyboard = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="6.5" width="18" height="11" rx="2" />
    <path d="M7 10h.1M10.3 10h.1M13.6 10h.1M17 10h.1M7.5 14h9" />
  </Svg>
);
export const IconWidget = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <path d="M7 9h4.5M7 12.5h10M7 15.5h7" />
  </Svg>
);
export const IconTaskbar = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="15.5" width="18" height="4.5" rx="1.2" />
    <rect x="12.5" y="16.7" width="6.5" height="2.1" rx="1" fill="currentColor" stroke="none" />
    <path d="M5 11.5h8" opacity=".5" />
  </Svg>
);
export const IconShield = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5 5 6.2v5.3c0 4.4 3 8 7 9 4-1 7-4.6 7-9V6.2Z" />
    <path d="m9 12 2.2 2.2L15.3 10" />
  </Svg>
);
export const IconPalette = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.2 0 1.8-.9 1.5-1.9-.4-1.1.3-2.2 1.5-2.2h1.8a3.7 3.7 0 0 0 3.7-3.7c0-5.1-3.8-9.2-8.5-9.2Z" />
    <circle cx="7.8" cy="11.2" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="10.4" cy="7.4" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="7.8" r="1.1" fill="currentColor" stroke="none" />
  </Svg>
);
export const IconCalc = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 3.5v17M3.5 12h17" opacity=".45" />
    <path d="M12 12 17 7" />
  </Svg>
);
export const IconTimer = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="13" r="7.5" />
    <path d="M12 9v4l2.5 1.5M9.5 2.8h5M18.5 6.5l1.2-1.2" />
  </Svg>
);
export const IconArrowUpRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 17 17 7M9 7h8v8" />
  </Svg>
);
export const IconDrag = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="7" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="7" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="9" cy="12" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="12" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="9" cy="17" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="17" r="1.1" fill="currentColor" stroke="none" />
  </Svg>
);
export const IconHeart = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 19.5s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 6.9a4.3 4.3 0 0 1 7.5 2.6c0 5.6-7.5 10-7.5 10Z" />
  </Svg>
);
export const IconReset = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v3.8h3.8" />
  </Svg>
);
export const IconZoomIn = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.2" />
    <path d="m15.6 15.6 4.2 4.2M8.5 11h5M11 8.5v5" />
  </Svg>
);
export const IconZoomOut = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.2" />
    <path d="m15.6 15.6 4.2 4.2M8.5 11h5" />
  </Svg>
);
export const IconSpread = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="8" height="14" rx="1.2" />
    <rect x="12.5" y="5" width="8" height="14" rx="1.2" />
  </Svg>
);
export const IconSinglePage = (p: IconProps) => (
  <Svg {...p}>
    <rect x="7" y="4" width="10" height="16" rx="1.2" />
  </Svg>
);
