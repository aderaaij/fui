import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { PERSONA } from './persona'

/**
 * Provider-interchangeable synthesis. Same persona, same inquiry shape,
 * same micro-dollar cost accounting either way — the rest of the Worker
 * (rate limits, budget ledger, charset clamp) never knows which model
 * answered. Switch with the AI_PROVIDER var in wrangler.jsonc (override in
 * .dev.vars locally); the matching *_API_KEY secret must be set.
 */

export interface ProviderEnv {
  AI_PROVIDER?: string
  ANTHROPIC_API_KEY?: string
  OPENAI_API_KEY?: string
}

export type Provider = 'anthropic' | 'openai'

export function activeProvider(env: ProviderEnv): Provider {
  return env.AI_PROVIDER === 'openai' ? 'openai' : 'anthropic'
}

/** The active provider's key — the caller degrades in-fiction when unset. */
export function providerKey(env: ProviderEnv): string | undefined {
  return activeProvider(env) === 'openai'
    ? env.OPENAI_API_KEY
    : env.ANTHROPIC_API_KEY
}

/** Upstream trouble, mapped away from provider-specific error classes. */
export class SynthesisUnavailable extends Error {
  /** busy: retrying shortly helps; fault: it doesn't */
  readonly kind: 'busy' | 'fault'
  constructor(kind: 'busy' | 'fault') {
    super(`synthesis ${kind}`)
    this.kind = kind
  }
}

export interface Synthesis {
  text: string
  costMicro: number
}

const REQUEST_TIMEOUT_MS = 20_000

// ~8 lines x 40 cols is ~100 tokens; the output caps are headroom and the
// hard ceiling on what a jailbroken inquiry could ever extract. Costs are
// micro-dollars per token, so the budget ledger meters both the same way.
const ANTHROPIC_MODEL = 'claude-haiku-4-5'
const ANTHROPIC_MAX_TOKENS = 300
// Haiku 4.5: $1/M input, $5/M output
const ANTHROPIC_INPUT_MICRO = 1
const ANTHROPIC_OUTPUT_MICRO = 5

const OPENAI_MODEL = 'gpt-5-mini'
// output cap covers reasoning tokens too, hence the extra headroom
const OPENAI_MAX_TOKENS = 400
// gpt-5-mini: $0.25/M input, $2/M output
const OPENAI_INPUT_MICRO = 0.25
const OPENAI_OUTPUT_MICRO = 2

export async function synthesize(
  env: ProviderEnv,
  inquiry: string,
): Promise<Synthesis> {
  const key = providerKey(env)
  if (!key) throw new SynthesisUnavailable('fault')
  return activeProvider(env) === 'openai'
    ? askOpenAI(key, inquiry)
    : askAnthropic(key, inquiry)
}

async function askAnthropic(
  apiKey: string,
  inquiry: string,
): Promise<Synthesis> {
  const client = new Anthropic({
    apiKey,
    maxRetries: 1,
    timeout: REQUEST_TIMEOUT_MS,
  })
  try {
    // No cache_control on the persona: it sits well under Haiku 4.5's
    // 4096-token minimum cacheable prefix, so a marker would silently no-op
    const message = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: ANTHROPIC_MAX_TOKENS,
      system: PERSONA,
      messages: [{ role: 'user', content: inquiry }],
    })
    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
    const costMicro = Math.ceil(
      message.usage.input_tokens * ANTHROPIC_INPUT_MICRO +
        message.usage.output_tokens * ANTHROPIC_OUTPUT_MICRO,
    )
    return { text, costMicro }
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      throw new SynthesisUnavailable('busy')
    }
    if (error instanceof Anthropic.APIConnectionError) {
      // subclass of APIError — must be caught first
      console.error('muthur anthropic connection', error.message)
      throw new SynthesisUnavailable('fault')
    }
    if (error instanceof Anthropic.APIError) {
      console.error('muthur anthropic', error.status, error.message)
      throw new SynthesisUnavailable('fault')
    }
    console.error('muthur anthropic', error)
    throw new SynthesisUnavailable('fault')
  }
}

async function askOpenAI(apiKey: string, inquiry: string): Promise<Synthesis> {
  const client = new OpenAI({
    apiKey,
    maxRetries: 1,
    timeout: REQUEST_TIMEOUT_MS,
  })
  try {
    const response = await client.responses.create({
      model: OPENAI_MODEL,
      instructions: PERSONA,
      input: inquiry,
      max_output_tokens: OPENAI_MAX_TOKENS,
      // gpt-5-mini reasons by default; MU/TH/UR's one-liners don't need it
      reasoning: { effort: 'minimal' },
    })
    const costMicro = Math.ceil(
      (response.usage?.input_tokens ?? 0) * OPENAI_INPUT_MICRO +
        (response.usage?.output_tokens ?? 0) * OPENAI_OUTPUT_MICRO,
    )
    return { text: response.output_text, costMicro }
  } catch (error) {
    if (error instanceof OpenAI.RateLimitError) {
      throw new SynthesisUnavailable('busy')
    }
    if (error instanceof OpenAI.APIConnectionError) {
      console.error('muthur openai connection', error.message)
      throw new SynthesisUnavailable('fault')
    }
    if (error instanceof OpenAI.APIError) {
      console.error('muthur openai', error.status, error.message)
      throw new SynthesisUnavailable('fault')
    }
    console.error('muthur openai', error)
    throw new SynthesisUnavailable('fault')
  }
}
