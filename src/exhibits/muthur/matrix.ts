/**
 * The OVERMONITORING ADDRESS MATRIX — MU/TH/UR's wake-up screen, transcribed
 * from reference/muthur-boot (Alien, 1979), including the film's own spelling
 * of "ALLIGNMENT".
 */

export const COLS = 64
export const ROWS = 20
export const TITLE_ROW = 2
export const MATRIX_START_ROW = 4

export const TITLE = 'OVERMONITORING  ADDRESS  MATRIX'

// [label, value, label, value] — columns at char offsets 0 / 14 / 28 / 44
export const MATRIX_ROWS: [string, string, string, string][] = [
  ['CRFX', 'OM2077AM', 'L ALLIGNMENT', 'SM2093'],
  ['ATTITUDE', 'SM2078', 'PHOTO F', 'SM2094'],
  ['WASTE HEAT', '2080', 'MAINS', ''],
  ['RAD', '2081', 'IUA', 'SM2096'],
  ['VENT', '2082AM', '2LA', 'SM2097'],
  ['NAVIGATION', 'M2083', '3RA', 'SM2098'],
  ['TIME', 'M2084', '4LHA', 'SM2099'],
  ['GAL POS', '', 'GRAY GRIDS', ''],
  ['COMMAND', '2086SC', 'INERTIAL DAMP', '3002AM'],
  ['INTERFACE', '2037', 'DECK A', 'A3003'],
  ['ATTN', '2087SC', 'DECK B', 'A3004'],
  ['ALERT', '2088SC', 'DECK C', 'A3005'],
  ['MARTIAL', '2090', 'LIFE SUPPORT', ''],
  ['OVERLOCK', 'M2091', '0%', 'M3003AM'],
]

/** Char offset where each column starts within a padded line (reveal math) */
export const COLUMN_OFFSETS = [0, 14, 28, 44]

export const MATRIX_LINES: string[] = MATRIX_ROWS.map(([a, b, c, d]) =>
  (a.padEnd(14) + b.padEnd(14) + c.padEnd(16) + d).trimEnd(),
)

/** Verbatim garbage fragments visible in the film's raster-noise phase. */
export const STORM_FRAGMENTS = [
  'SYS 0',
  'SYS 6',
  'FL12 4',
  'R18L',
  'W55',
  'RM7 G',
  'SXX C',
  'N 3 EEEE',
  'ZZZZ',
  'AAAAA 99999',
  'DDDDD',
  '67DD',
  'H!11',
  '999',
  'GGGLLLIIII',
  'E R18L',
  'NO B',
  'STO 0',
]

export const STORM_GLYPHS = 'ABCDEFGHILMNORSTVWXYZ0123456789_!'

/**
 * Every character the exhibit can display. Rendered invisibly during the
 * circuit-glyph phase so troika generates the full SDF atlas before the
 * storm needs it — otherwise cold loads play the storm on an empty atlas.
 */
export const CHARSET = Array.from(
  new Set(
    (
      STORM_GLYPHS +
      STORM_FRAGMENTS.join('') +
      TITLE +
      MATRIX_LINES.join('') +
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,:;()/%!?'-_>"
    ).split(''),
  ),
).join('')
