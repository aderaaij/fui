/** Typed onto the tube when the INTERFACE 2037 record opens. */
export const INTERFACE_TITLE = 'INTERFACE 2037 READY FOR INQUIRY'

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

/** The film's own inquiries answer verbatim and never leave the page. */
function respondScripted(inquiry: string): string[] | null {
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
  return null
}

/** Worker unreachable = the film's unknown-command reply, as before the AI. */
const OFFLINE = ['UNABLE TO CLARIFY']

/**
 * Film inquiries answer from the script above; anything else goes to the
 * Worker (see worker/index.ts), where MU/TH/UR's persona synthesizes a
 * reply. The Worker answers denials — rate, budget, faults — in the same
 * lines-on-the-tube shape, so whatever comes back just gets printed.
 */
export async function respond(inquiry: string): Promise<string[]> {
  const scripted = respondScripted(inquiry)
  if (scripted) return scripted
  try {
    const res = await fetch('/api/muthur', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ inquiry }),
      signal: AbortSignal.timeout(25_000),
    })
    const data: unknown = await res.json()
    const lines = (data as { lines?: unknown }).lines
    if (
      Array.isArray(lines) &&
      lines.length > 0 &&
      lines.every((line) => typeof line === 'string')
    ) {
      return lines
    }
    return OFFLINE
  } catch {
    return OFFLINE
  }
}
