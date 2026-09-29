import { CalculationMethod } from 'adhan';
import type { AsrMethod } from './types';

/**
 * Calculation methods. Every entry cites where its parameters come from.
 *  - `adhan`: built into adhan-js (github.com/batoulapps/adhan-js/blob/main/METHODS.md)
 *  - `aladhan`: Aladhan methods reference, fetched 2026-09-28 from https://api.aladhan.com/v1/methods
 *    and the per-method offsets from https://api.aladhan.com/v1/timings (meta.offset); copies are kept in
 *    data-pipeline/sources/aladhan-methods.json and aladhan-method-offsets.json.
 */
export interface MethodDef {
  id: MethodId;
  /** adhan-js CalculationMethod key to start from, or null for "Other" + our own parameters. */
  adhanBase:
    | 'MuslimWorldLeague'
    | 'Egyptian'
    | 'Karachi'
    | 'UmmAlQura'
    | 'Dubai'
    | 'MoonsightingCommittee'
    | 'NorthAmerica'
    | 'Kuwait'
    | 'Qatar'
    | 'Singapore'
    | 'Tehran'
    | 'Turkey'
    | null;
  fajrAngle?: number;
  ishaAngle?: number;
  ishaInterval?: number; // minutes after Maghrib
  maghribAngle?: number;
  /** Fixed method offsets in minutes (e.g. Morocco adds 5 min to Dhuhr and Maghrib). */
  adjustments?: Partial<Record<'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha', number>>;
  /** Extra Isha minutes during Ramadan (Umm al-Qura: +30). */
  ramadanIshaExtra?: number;
  source: string;
  note?: string;
}

export const METHOD_IDS = [
  'mwl',
  'egypt',
  'umm_al_qura',
  'karachi',
  'isna',
  'moonsighting',
  'dubai',
  'qatar',
  'kuwait',
  'gulf',
  'singapore',
  'jakim',
  'kemenag',
  'turkey',
  'tehran',
  'jafari',
  'jordan',
  'tunisia',
  'algeria',
  'morocco',
  'france_uoif',
  'france_15',
  'france_18',
  'russia',
  'portugal',
  'custom',
] as const;
export type MethodId = (typeof METHOD_IDS)[number];

const ADHAN_SRC = 'https://github.com/batoulapps/adhan-js/blob/main/METHODS.md';
const ALADHAN_SRC = 'https://aladhan.com/calculation-methods (api.aladhan.com/v1/methods, fetched 2026-09-28)';

export const METHODS: Record<MethodId, MethodDef> = {
  mwl: { id: 'mwl', adhanBase: 'MuslimWorldLeague', source: ADHAN_SRC },
  egypt: { id: 'egypt', adhanBase: 'Egyptian', source: ADHAN_SRC },
  umm_al_qura: {
    id: 'umm_al_qura',
    adhanBase: 'UmmAlQura',
    ramadanIshaExtra: 30,
    source: ADHAN_SRC,
    note: 'Isha is 90 minutes after Maghrib, 120 minutes during Ramadan.',
  },
  karachi: { id: 'karachi', adhanBase: 'Karachi', source: ADHAN_SRC },
  isna: { id: 'isna', adhanBase: 'NorthAmerica', source: ADHAN_SRC },
  moonsighting: { id: 'moonsighting', adhanBase: 'MoonsightingCommittee', source: ADHAN_SRC },
  dubai: { id: 'dubai', adhanBase: 'Dubai', source: ADHAN_SRC },
  qatar: { id: 'qatar', adhanBase: 'Qatar', source: ADHAN_SRC },
  kuwait: { id: 'kuwait', adhanBase: 'Kuwait', source: ADHAN_SRC },
  gulf: { id: 'gulf', adhanBase: null, fajrAngle: 19.5, ishaInterval: 90, source: `${ALADHAN_SRC} — GULF (id 8)` },
  singapore: { id: 'singapore', adhanBase: 'Singapore', source: ADHAN_SRC },
  jakim: { id: 'jakim', adhanBase: null, fajrAngle: 20, ishaAngle: 18, source: `${ALADHAN_SRC} — JAKIM (id 17)` },
  kemenag: { id: 'kemenag', adhanBase: null, fajrAngle: 20, ishaAngle: 18, source: `${ALADHAN_SRC} — KEMENAG (id 20)` },
  turkey: {
    id: 'turkey',
    adhanBase: 'Turkey',
    source: ADHAN_SRC,
    note: 'Approximation of Diyanet times (sunrise −7, Dhuhr +5, Asr +4, Maghrib +7 min).',
  },
  tehran: { id: 'tehran', adhanBase: 'Tehran', source: ADHAN_SRC },
  jafari: {
    id: 'jafari',
    adhanBase: null,
    fajrAngle: 16,
    ishaAngle: 14,
    maghribAngle: 4,
    source: `${ALADHAN_SRC} — JAFARI (id 0)`,
  },
  jordan: {
    id: 'jordan',
    adhanBase: null,
    fajrAngle: 18,
    ishaAngle: 18,
    adjustments: { maghrib: 5 },
    source: `${ALADHAN_SRC} — JORDAN (id 23)`,
  },
  tunisia: { id: 'tunisia', adhanBase: null, fajrAngle: 18, ishaAngle: 18, source: `${ALADHAN_SRC} — TUNISIA (id 18)` },
  algeria: {
    id: 'algeria',
    adhanBase: null,
    fajrAngle: 18,
    ishaAngle: 17,
    source: `Algerian Ministry of Religious Affairs and Wakfs (Fajr 18°, Isha 17°); ${ALADHAN_SRC} — ALGERIA (id 19)`,
    note: 'The ministry publishes official timetables; compare with them and fine-tune with offsets or import the timetable.',
  },
  morocco: {
    id: 'morocco',
    adhanBase: null,
    fajrAngle: 19,
    ishaAngle: 17,
    adjustments: { dhuhr: 5, maghrib: 5 },
    source: `${ALADHAN_SRC} — MOROCCO (id 21)`,
  },
  france_uoif: {
    id: 'france_uoif',
    adhanBase: null,
    fajrAngle: 12,
    ishaAngle: 12,
    source: `${ALADHAN_SRC} — FRANCE (id 12)`,
  },
  france_15: {
    id: 'france_15',
    adhanBase: null,
    fajrAngle: 15,
    ishaAngle: 15,
    source: 'Angle convention (15°/15°) used by several French mosques',
  },
  france_18: {
    id: 'france_18',
    adhanBase: null,
    fajrAngle: 18,
    ishaAngle: 18,
    source: 'Angle convention (18°/18°) used by several French mosques',
  },
  russia: { id: 'russia', adhanBase: null, fajrAngle: 16, ishaAngle: 15, source: `${ALADHAN_SRC} — RUSSIA (id 14)` },
  portugal: {
    id: 'portugal',
    adhanBase: null,
    fajrAngle: 18,
    ishaInterval: 77,
    adjustments: { dhuhr: 5, maghrib: 3 },
    source: `${ALADHAN_SRC} — PORTUGAL (id 22)`,
  },
  custom: { id: 'custom', adhanBase: null, fajrAngle: 18, ishaAngle: 17, source: 'User-defined' },
};

export function isMethodId(v: string): v is MethodId {
  return (METHOD_IDS as readonly string[]).includes(v);
}

/** Country → default method. Entries marked `verify` are listed in docs/OPEN_QUESTIONS.md. */
const COUNTRY_METHOD: Record<string, MethodId> = {
  DZ: 'algeria',
  MA: 'morocco',
  TN: 'tunisia',
  LY: 'egypt',
  EG: 'egypt',
  SD: 'egypt',
  SA: 'umm_al_qura',
  YE: 'umm_al_qura',
  AE: 'dubai',
  QA: 'qatar',
  KW: 'kuwait',
  BH: 'gulf', // verify
  OM: 'gulf', // verify
  JO: 'jordan',
  PS: 'jordan', // verify
  LB: 'mwl', // verify
  SY: 'mwl', // verify
  IQ: 'mwl', // verify
  TR: 'turkey',
  PK: 'karachi',
  IN: 'karachi',
  BD: 'karachi',
  AF: 'karachi',
  MY: 'jakim',
  ID: 'kemenag',
  SG: 'singapore',
  FR: 'france_uoif', // the user is asked (UOIF or MWL) during onboarding
  US: 'moonsighting',
  CA: 'moonsighting',
  GB: 'moonsighting',
  IR: 'tehran',
  RU: 'russia',
  PT: 'portugal',
};

export function defaultMethodFor(country: string | undefined): MethodId {
  return (country && COUNTRY_METHOD[country.toUpperCase()]) || 'mwl';
}

/** Asr always follows the majority (Jumhur) opinion (owner's decision); kept as a function for existing callers. */
export function defaultAsrFor(_country?: string | undefined): AsrMethod {
  return 'standard';
}

/** Countries where onboarding asks the user to choose between two common conventions. */
export const COUNTRY_METHOD_CHOICES: Record<string, MethodId[]> = {
  FR: ['france_uoif', 'mwl', 'france_15', 'france_18'],
};

export interface MethodSummary {
  fajrAngle: number;
  /** Isha by angle, or … */
  ishaAngle: number | null;
  /** … a fixed number of minutes after Maghrib */
  ishaInterval: number | null;
  /** fixed offsets in minutes, non-zero only */
  adjustments: [string, number][];
}

/** The twilight angles and offsets a method uses, for display (the same values the engine uses). */
export function methodSummary(id: MethodId): MethodSummary {
  const def = METHODS[id];
  const p = def.adhanBase ? CalculationMethod[def.adhanBase]() : null;
  const fajrAngle = p ? p.fajrAngle : (def.fajrAngle ?? 18);
  const interval = p ? p.ishaInterval : (def.ishaInterval ?? 0);
  const ishaAngle = p ? p.ishaAngle : (def.ishaAngle ?? 0);
  const adj: Record<string, number> = { ...(p ? p.methodAdjustments : {}), ...(def.adjustments ?? {}) };
  return {
    fajrAngle,
    ishaAngle: interval > 0 ? null : ishaAngle,
    ishaInterval: interval > 0 ? interval : null,
    adjustments: Object.entries(adj).filter(([, v]) => v !== 0),
  };
}
