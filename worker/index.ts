import { MuthurBudget } from './budget'
import { providerKey, synthesize, SynthesisUnavailable, type ProviderEnv } from './synthesis'

export { MuthurBudget }

/**
 * The inquiry endpoint behind INTERFACE 2037. The browser only ever sends
 * the typed inquiry string — provider, model, prompt, token caps and history
 * shape all live here (see synthesis.ts), so the endpoint can't be
 * repurposed as a general model proxy. Every denial answers in-fiction; the
 * client prints whatever lines it gets.
 */

interface RateLimiterBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>
}

export interface Env extends ProviderEnv {
  BUDGET: DurableObjectNamespace<MuthurBudget>
  RATE_LIMITER: RateLimiterBinding
  ASSETS: Fetcher
  DAILY_BUDGET_USD: string
  IP_DAILY_LIMIT: string
}

const MAX_INQUIRY_CHARS = 120

// The terminal renders 43 columns; muthur.ts wraps its scripted lines by hand
const LINE_COLS = 42
const MAX_LINES = 12

// When synthesis is unavailable — budget spent, key missing, upstream fault —
// unscripted inquiries get the film's unknown-command reply, same as the
// pre-AI exhibit. Degradation is invisible; only pacing denials say more.
const UNABLE_TO_CLARIFY = ['UNABLE TO CLARIFY']

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/api/muthur' && request.method === 'POST') {
      return inquiry(request, env, ctx)
    }
    if (url.pathname.startsWith('/api/')) {
      return reply(404, ['NO SUCH ADDRESS'])
    }
    // run_worker_first only routes /api/* here, but be a good fallback
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>

async function inquiry(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  let asked: string
  try {
    const body = (await request.json()) as { inquiry?: unknown }
    if (typeof body.inquiry !== 'string') throw new Error('shape')
    asked = body.inquiry.trim()
  } catch {
    return reply(400, ['INPUT NOT RECOGNIZED'])
  }
  if (!asked || asked.length > MAX_INQUIRY_CHARS) {
    return reply(400, ['INPUT NOT RECOGNIZED'])
  }

  // A missing secret must degrade in-fiction, not surface a raw error page —
  // and it shouldn't charge the ledger, so check before authorize
  if (!providerKey(env)) {
    console.error('muthur: no API key configured for the active provider')
    return reply(503, UNABLE_TO_CLARIFY)
  }

  const ip = request.headers.get('cf-connecting-ip') ?? 'unmetered'

  // Burst control first (cheap, no storage), then the daily ledger
  const { success } = await env.RATE_LIMITER.limit({ key: ip })
  if (!success) return reply(429, ['INQUIRY RATE EXCEEDED', 'STAND BY'])

  const meter = env.BUDGET.get(env.BUDGET.idFromName('meter'))
  const budgetMicro = Math.round(Number(env.DAILY_BUDGET_USD) * 1_000_000)
  const verdict = await meter.authorize(
    await hashIp(ip),
    budgetMicro,
    Number(env.IP_DAILY_LIMIT),
  )
  if (verdict === 'budget') {
    return reply(503, UNABLE_TO_CLARIFY)
  }
  if (verdict === 'ip') {
    return reply(429, ['DAILY INQUIRY LIMIT REACHED', 'TERMINAL ACCESS SUSPENDED'])
  }

  try {
    const { text, costMicro } = await synthesize(env, asked)
    ctx.waitUntil(meter.record(costMicro))
    const lines = toLines(text)
    return reply(200, lines.length ? lines : ['DOES NOT COMPUTE'])
  } catch (error) {
    if (error instanceof SynthesisUnavailable && error.kind === 'busy') {
      return reply(503, ['ALL CHANNELS BUSY', 'STAND BY'])
    }
    // logged with provider detail inside synthesis.ts
    return reply(502, UNABLE_TO_CLARIFY)
  }
}

function reply(status: number, lines: string[]): Response {
  return Response.json({ lines }, { status })
}

/** The ledger keys on a hash so raw visitor IPs never hit storage. */
async function hashIp(ip: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(ip),
  )
  return [...new Uint8Array(digest).slice(0, 8)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Clamp model output to what the tube can print: uppercase, the exhibit's
 * charset, word-wrapped to the film's measure, a screenful at most. This is
 * the real jailbreak backstop — nothing useful survives a 12-line teletype.
 */
function toLines(raw: string): string[] {
  const cleaned = raw
    .toUpperCase()
    .replace(/[‘’‛“”]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^A-Z0-9 .,:;()/%!?'\-_\n]/g, '')

  const lines: string[] = []
  for (const para of cleaned.split('\n')) {
    const words = para.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
    if (words.length === 0) {
      lines.push('')
      continue
    }
    let line = ''
    for (let word of words) {
      while (word.length > LINE_COLS) {
        if (line) {
          lines.push(line)
          line = ''
        }
        lines.push(word.slice(0, LINE_COLS))
        word = word.slice(LINE_COLS)
      }
      if (!line) line = word
      else if (line.length + 1 + word.length <= LINE_COLS) line += ' ' + word
      else {
        lines.push(line)
        line = word
      }
    }
    if (line) lines.push(line)
  }

  // Collapse blank runs, trim blank edges, cap to a screenful
  const out: string[] = []
  for (const l of lines) {
    if (l === '' && (out.length === 0 || out[out.length - 1] === '')) continue
    out.push(l)
  }
  while (out.length && out[out.length - 1] === '') out.pop()
  return out.slice(0, MAX_LINES)
}
