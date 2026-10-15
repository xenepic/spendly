import type { Category, TxKind } from './types'

export const UNCATEGORIZED = 'uncategorized'

/** 初期カテゴリ。色はUIモックの配色を起点に、同系統のトーンで拡張している */
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'supermarket', name: 'スーパー', color: '#39785a', order: 0 },
  { id: 'dining', name: '外食', color: '#8eb39a', order: 1 },
  { id: 'food', name: '食品・お土産', color: '#c9a66b', order: 1.5 },
  { id: 'convenience', name: 'コンビニ', color: '#d5a278', order: 2 },
  { id: 'daily', name: '日用品', color: '#e1c8a5', order: 3 },
  { id: 'drugstore', name: 'ドラッグストア', color: '#5f9479', order: 4 },
  { id: 'transport', name: '交通', color: '#b5c8b8', order: 5 },
  { id: 'shopping', name: 'ショッピング', color: '#b58a68', order: 6 },
  { id: 'hobby', name: '趣味・娯楽', color: '#c9b98c', order: 7 },
  { id: 'travel', name: '旅行・宿泊', color: '#6f9ea3', order: 7.5 },
  { id: 'digital', name: 'デジタル', color: '#7f9f95', order: 8 },
  { id: 'medical', name: '医療', color: '#a6bcb4', order: 9 },
  { id: 'furusato', name: 'ふるさと納税', color: '#d9b896', order: 10 },
  { id: 'other', name: 'その他', color: '#dce2d8', order: 11 },
  { id: UNCATEGORIZED, name: '未分類', color: '#c4cbc1', order: 99 },
]

/** カテゴリ追加時の色候補 */
export const EXTRA_COLORS = ['#4f8a6b', '#a3c4ad', '#e0b48f', '#9fb3a7', '#c7a07f', '#88a891', '#d8cdb0']

export const KIND_LABEL: Record<TxKind, string> = {
  payment: '支払い',
  bill: '請求書払い・税金',
  charge: 'チャージ',
  transfer_out: '送金',
  transfer_in: '受け取り',
  refund: '返金',
  point: 'ポイント',
  investment: 'ポイント運用',
  withdrawal: '出金',
  unknown: '要確認',
}

export const KIND_ORDER: TxKind[] = [
  'payment',
  'bill',
  'refund',
  'charge',
  'transfer_out',
  'transfer_in',
  'point',
  'investment',
  'withdrawal',
  'unknown',
]
