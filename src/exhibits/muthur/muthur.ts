import type { BootLine } from '@/lib/terminal/useBootSequence'

/**
 * Shown after the overmonitoring matrix settles. In the film this is a
 * separate display (Ripley's session); here it follows the wake-up so the
 * exhibit stays usable.
 */
export const INTERFACE_SCRIPT: BootLine[] = [
  { delay: 700, text: '' },
  { delay: 600, text: 'INTERFACE 2037 READY FOR INQUIRY' },
  { delay: 450, text: '' },
]

const SPECIAL_ORDER = [
  'SPECIAL ORDER 937',
  'SCIENCE OFFICER EYES ONLY',
  '',
  'NOSTROMO REROUTED',
  'TO NEW CO-ORDINATES.',
  'INVESTIGATE LIFE FORM. GATHER SPECIMEN.',
  '',
  'PRIORITY ONE',
  'INSURE RETURN OF ORGANISM',
  'FOR ANALYSIS.',
  'ALL OTHER CONSIDERATIONS SECONDARY.',
  'CREW EXPENDABLE.',
]

/** MU/TH/UR answers a small set of inquiries, as in the film. */
export function respond(inquiry: string): string[] {
  const q = inquiry.toUpperCase().trim()
  if (!q) return []
  if (q.includes('937') || q.includes('SPECIAL ORDER')) return SPECIAL_ORDER
  if (q.includes('SCIENCE') && q.includes('OFFICER')) {
    return ['SCIENCE OFFICER: ASH', 'REFER: SPECIAL ORDER 937']
  }
  if (q.includes('CREW')) {
    return ['CREW: 7', 'DALLAS / KANE / RIPLEY / LAMBERT / ASH / PARKER / BRETT']
  }
  if (q.includes('MOTHER') || q.includes('MU/TH/UR')) return ['MU/TH/UR 6000 ON LINE']
  if (q.includes('DESTINATION') || q.includes('EARTH')) {
    return ['DESTINATION: EARTH', 'ETA 10 MONTHS 3 DAYS']
  }
  if (q.includes('OVERRIDE') || q.includes('100375')) {
    return ['EMERGENCY COMMAND OVERRIDE 100375', 'WHAT IS YOUR CLEARANCE?']
  }
  if (q.includes('SIGNAL') || q.includes('TRANSMISSION') || q.includes('BEACON')) {
    return ['ORIGIN: LV-426', 'APPARENT DISTRESS CALL... ANALYSIS INCOMPLETE']
  }
  return ['UNABLE TO CLARIFY']
}
