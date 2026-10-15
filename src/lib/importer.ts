import { decodeCsv } from './encoding'
import { parsePayPayCsv } from './csv/parsePayPay'
import { UNCATEGORIZED } from './categories'
import { resolveMerchant } from './merchants'
import { newId, type SpendlyDB } from './db'
import type { ImportHistory, Merchant, Transaction } from './types'

/** CSVファイルの内容を解析し、重複を除いてIndexedDBへ保存する */
export async function importCsv(db: SpendlyDB, bytes: ArrayBuffer | Uint8Array, fileName: string): Promise<ImportHistory> {
  const { text, encoding } = decodeCsv(bytes)
  const parsed = parsePayPayCsv(text)
  const importId = newId()

  const ids = parsed.rows.map((r) => r.id)
  return db.transaction('rw', [db.transactions, db.importHistories, db.merchants, db.merchantRules], async () => {
    const existing = await db.transactions.bulkGet(ids)
    const fresh: Transaction[] = parsed.rows
      .filter((_, i) => existing[i] == null)
      .map((r) => ({ ...r, importId }))

    // 新しく現れた店舗を登録（カテゴリは組み込みルールで初期設定）
    const rules = await db.merchantRules.toArray()
    const newMerchants = new Map<string, Merchant>()
    for (const t of fresh) {
      if (t.kind !== 'payment' && t.kind !== 'unknown') continue
      const r = resolveMerchant(t.payee, rules)
      if (!newMerchants.has(r.merchant)) {
        newMerchants.set(r.merchant, { name: r.merchant, categoryId: r.ruleCategory ?? r.builtinCategory ?? UNCATEGORIZED, manual: false })
      }
    }
    const known = await db.merchants.bulkGet([...newMerchants.keys()])
    const merchantsToAdd = [...newMerchants.values()].filter((_, i) => known[i] == null)

    const months = parsed.rows.map((r) => r.occurredAt).sort()
    const history: ImportHistory = {
      id: importId,
      fileName,
      importedAt: new Date().toISOString(),
      format: parsed.format,
      encoding,
      totalRows: parsed.totalRows,
      added: fresh.length,
      duplicates: parsed.rows.length - fresh.length,
      skipped: parsed.skipped,
      unknown: fresh.filter((t) => t.kind === 'unknown').length,
      errors: parsed.errors,
      periodFrom: months[0],
      periodTo: months[months.length - 1],
    }
    await db.transactions.bulkAdd(fresh)
    await db.merchants.bulkAdd(merchantsToAdd)
    await db.importHistories.add(history)
    return history
  })
}
