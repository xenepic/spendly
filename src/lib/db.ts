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
