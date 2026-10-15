import Dexie, { type EntityTable } from 'dexie'
import { DEFAULT_CATEGORIES, DEFAULT_EMOJI, MERGED_CATEGORIES } from './categories'
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
    // v3: 税金・公共料金カテゴリを追加
    this.version(3).upgrade(async (tx) => {
      const table = tx.table('categories')
      const tax = DEFAULT_CATEGORIES.find((c) => c.id === 'tax')
      if (tax && !(await table.get('tax'))) await table.add(tax)
    })
    // v4: カテゴリを統合して9カテゴリに整理し、配色を見直し
    this.version(4).upgrade(async (tx) => {
      const categories = tx.table('categories')
      const remap = (id: string) => MERGED_CATEGORIES[id] ?? id
      await tx.table('merchants').toCollection().modify((m: { categoryId: string }) => {
        m.categoryId = remap(m.categoryId)
      })
      await tx.table('txOverrides').toCollection().modify((o: { categoryId?: string }) => {
        if (o.categoryId) o.categoryId = remap(o.categoryId)
      })
      await categories.bulkDelete(Object.keys(MERGED_CATEGORIES))
      for (const d of DEFAULT_CATEGORIES) {
        const cur = (await categories.get(d.id)) as Category | undefined
        if (!cur) {
          await categories.add(d)
          continue
        }
        // ユーザーが名前・色を変えていない場合のみ新しい初期値にする
        const old = V3_DEFAULTS[d.id]
        await categories.update(d.id, {
          order: d.order,
          ...(old && cur.name === old.name ? { name: d.name } : {}),
          ...(old && cur.color === old.color ? { color: d.color } : {}),
        })
      }
    })
    // v5: カテゴリに絵文字を追加（初期カテゴリは既定の絵文字、追加したカテゴリは汎用の絵文字）
    this.version(5).upgrade(async (tx) => {
      const defaults = new Map(DEFAULT_CATEGORIES.map((c) => [c.id, c.emoji]))
      await tx.table('categories').toCollection().modify((c: Category) => {
        if (!c.emoji) c.emoji = defaults.get(c.id) ?? DEFAULT_EMOJI
      })
    })
    this.on('populate', (tx) => {
      tx.table('categories').bulkAdd(DEFAULT_CATEGORIES)
    })
  }
}

/** v3 までの初期カテゴリの名前・色（v4 移行で未変更かを判定する） */
const V3_DEFAULTS: Record<string, { name: string; color: string }> = {
  supermarket: { name: 'スーパー', color: '#39785a' },
  dining: { name: '外食', color: '#8eb39a' },
  convenience: { name: 'コンビニ', color: '#d5a278' },
  daily: { name: '日用品', color: '#e1c8a5' },
  drugstore: { name: 'ドラッグストア', color: '#5f9479' },
  transport: { name: '交通', color: '#b5c8b8' },
  shopping: { name: 'ショッピング', color: '#b58a68' },
  hobby: { name: '趣味・娯楽', color: '#c9b98c' },
  tax: { name: '税金・公共料金', color: '#8c9c86' },
  other: { name: 'その他', color: '#dce2d8' },
  uncategorized: { name: '未分類', color: '#c4cbc1' },
}

export const db = new SpendlyDB()

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
