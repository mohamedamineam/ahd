// All fonts are bundled locally (no CDN at runtime) — only the Arabic and Latin subsets.
// OFL-1.1 — licence texts in docs/licenses/fonts.
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans/latin-ext-400.css';
import '@fontsource/ibm-plex-sans/latin-ext-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';
// Arabic headings use Changa: its dots are part of each letter. Reem Kufi's Arabic places dots as marks, which
// WebKitGTK 2.52 draws on the baseline (see src/features/shaping/engine.ts); Reem Kufi is kept for Latin.
import '@fontsource/changa/arabic-400.css';
import '@fontsource/changa/arabic-500.css';
import '@fontsource/changa/arabic-600.css';
import '@fontsource/reem-kufi/latin-400.css';
import '@fontsource/reem-kufi/latin-500.css';
import '@fontsource/reem-kufi/latin-600.css';
import '@fontsource/amiri/arabic-400.css';
import '@fontsource/amiri/arabic-700.css';
import '@fontsource/amiri/latin-400.css';
import '@fontsource/aref-ruqaa/arabic-400.css';
import '@fontsource/aref-ruqaa/arabic-700.css';
