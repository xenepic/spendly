import Dexie, { type EntityTable } from 'dexie'
import { DEFAULT_CATEGORIES } from './categories'
import type { Category, ImportHistory, Merchant, MerchantRule, Transaction, TxOverride } from './types'

export class SpendlyDB extends Dexie {
  transactions!: EntityTable<Transaction, 'id'>
  merchants!: EntityTable<Merchant, 'name'>
  categories!: EntityTable<Category, 'id'>
  merchantRules!: EntityTable<MerchantRule, 'id'>
  txOverrides!: EntityTable<TxOverride, 'txId'>
  importHistories!: EntityTable<ImportHistory, 'id'>

  constructor(name = 'spendly') {
    super(name)
    this.version(1).stores({
      transactions: 'id, importId, month, occurredAt, kind, payee',
      merchants: 'name, categoryId',
      categories: 'id, order',
      merchantRules: 'id, merchant',
      txOverrides: 'txId',
      importHistories: 'id, importedAt',
    })
    // v2: 実データに合わせて追加した初期カテゴリ（食品・お土産／旅行・宿泊）を既存DBにも追加
    this.version(2).upgrade(async (tx) => {
      const table = tx.table('categories')
      const existing = new Set((await table.toArray()).map((c: { id: string }) => c.id))
      await table.bulkAdd(DEFAULT_CATEGORIES.filter((c) => !existing.has(c.id)))
    })
    this.on('populate', (tx) => {
      tx.table('categories').bulkAdd(DEFAULT_CATEGORIES)
    })
  }
}

export const db = new SpendlyDB()

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
