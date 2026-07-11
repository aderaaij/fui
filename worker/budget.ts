import { DurableObject } from 'cloudflare:workers'

/**
 * One global object ("meter") holds the day's ledger: total spend in
 * micro-dollars plus a per-IP inquiry count. When either cap is hit the
 * exhibit degrades to its scripted fallback — MU/TH/UR going down for
 * maintenance is in-fiction, so exhaustion is a feature, not an outage.
 */
interface DayLedger {
  date: string
  spentMicro: number
  inquiries: Record<string, number>
}

export type Denial = 'budget' | 'ip'

export class MuthurBudget extends DurableObject {
  /**
   * Claim one inquiry slot before calling the model. Charges the per-IP
   * count up front; token spend is settled after the reply via record().
   */
  async authorize(
    ipKey: string,
    dailyBudgetMicro: number,
    ipDailyLimit: number,
  ): Promise<Denial | 'ok'> {
    const ledger = await this.today()
    if (ledger.spentMicro >= dailyBudgetMicro) return 'budget'
    const used = ledger.inquiries[ipKey] ?? 0
    if (used >= ipDailyLimit) return 'ip'
    ledger.inquiries[ipKey] = used + 1
    await this.ctx.storage.put('day', ledger)
    return 'ok'
  }

  async record(costMicro: number): Promise<void> {
    const ledger = await this.today()
    ledger.spentMicro += costMicro
    await this.ctx.storage.put('day', ledger)
  }

  private async today(): Promise<DayLedger> {
    const date = new Date().toISOString().slice(0, 10)
    const ledger = await this.ctx.storage.get<DayLedger>('day')
    if (ledger && ledger.date === date) return ledger
    return { date, spentMicro: 0, inquiries: {} }
  }
}
