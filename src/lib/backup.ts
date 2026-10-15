import type { SpendlyDB } from './db'

export const BACKUP_APP = 'spendly'
export const BACKUP_VERSION = 1

const TABLES = ['transactions', 'merchants', 'categories', 'merchantRules', 'txOverrides', 'importHistories'] as const
type TableName = (typeof TABLES)[number]

export interface Backup {
  app: typeof BACKUP_APP
  version: number
  exportedAt: string
  tables: Record<TableName, unknown[]>
}

export async function exportBackup(db: SpendlyDB): Promise<Backup> {
  const tables = {} as Backup['tables']
  await db.transaction('r', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) tables[t] = await db.table(t).toArray()
  })
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), tables }
}

export function validateBackup(data: unknown): Backup {
  const b = data as Partial<Backup>
  if (!b || b.app !== BACKUP_APP || typeof b.version !== 'number' || typeof b.tables !== 'object' || !b.tables) {
    throw new Error('Spendlyのバックアップファイルではありません。')
  }
  if (b.version > BACKUP_VERSION) throw new Error('このバージョンでは読み込めない新しい形式のバックアップです。')
  for (const t of TABLES) {
    if (!Array.isArray(b.tables[t])) throw new Error(`バックアップに ${t} がありません。`)
  }
  for (const tx of b.tables.transactions as Record<string, unknown>[]) {
    if (typeof tx.id !== 'string' || !Number.isInteger(tx.amount) || typeof tx.occurredAt !== 'string') {
      throw new Error('取引データの形式が正しくありません。')
    }
  }
  return b as Backup
}

/** 現在のデータをすべて置き換えて復元する */
export async function restoreBackup(db: SpendlyDB, data: unknown): Promise<void> {
  const b = validateBackup(data)
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      await db.table(t).clear()
      await db.table(t).bulkAdd(b.tables[t])
    }
  })
}

/** 取引・分類・履歴をすべて削除し、カテゴリを初期状態に戻す */
export async function clearAll(db: SpendlyDB, defaults: unknown[]): Promise<void> {
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) await db.table(t).clear()
    await db.table('categories').bulkAdd(defaults)
  })
}
