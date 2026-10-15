import { UNCATEGORIZED } from './categories'
import { builtinCategoryOf, resolveMerchant } from './merchants'
import { classifyTx } from './csv/parsePayPay'
import type { EnrichedTx, Merchant, MerchantRule, Transaction, TxOverride } from './types'

/**
 * 元の取引に分類情報（正規化店舗名・カテゴリ・手動上書き）を付加する。
 * 元データは変更せず、ルールや分類を変えるたびにここから再計算する。
 * カテゴリの優先順位: 取引単位の手動変更 > 店舗の手動設定 > 組み込みルール > 店舗の初期値 > 未分類
 */
export function enrich(
  txs: Transaction[],
  overrides: TxOverride[],
  merchants: Merchant[],
  rules: MerchantRule[],
  validCategoryIds?: Set<string>,
): EnrichedTx[] {
  const ovMap = new Map(overrides.map((o) => [o.txId, o]))
  const mMap = new Map(merchants.map((m) => [m.name, m]))
  const cache = new Map<string, ReturnType<typeof resolveMerchant>>()
  const valid = (id: string | undefined) =>
    id != null && (validCategoryIds == null || validCategoryIds.has(id)) ? id : undefined

  return txs.map((t) => {
    const ov = ovMap.get(t.id)
    let r = cache.get(t.payee)
    if (!r) {
      r = resolveMerchant(t.payee, rules)
      cache.set(t.payee, r)
    }
    const m = mMap.get(r.merchant)
    const merchantCategory = m?.manual
      ? valid(m.categoryId)
      : (valid(r.builtinCategory) ?? valid(builtinCategoryOf(r.merchant)) ?? valid(m?.categoryId))
    const overridden = valid(ov?.categoryId)
    const autoKind = classifyTx(t)
    return {
      ...t,
      autoKind,
      effectiveKind: ov?.kind ?? autoKind,
      merchant: r.merchant,
      categoryId: overridden ?? merchantCategory ?? UNCATEGORIZED,
      categoryOverridden: overridden != null,
    }
  })
}
