import type { Category, TxKind } from './types'

export const UNCATEGORIZED = 'uncategorized'

/**
 * 初期カテゴリ（9カテゴリ＋その他・未分類）。
 * 8色の色相は色覚多様性を考慮した検証（隣接する色どうしの CVD ΔE ≥ 8・通常視 ΔE ≥ 15）を通した組み合わせで、
 * ドーナツグラフはこの order の順に並べるため、隣り合う色が常に見分けやすくなる。
 * 税金・その他・未分類は、色付きのカテゴリより目立たない明度の異なるグレーにしている。
 */
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'supermarket', name: 'スーパー・食品', color: '#2e8058', order: 0 },
  { id: 'drugstore', name: 'ドラッグストア・医療', color: '#8a6bc9', order: 1 },
  { id: 'daily', name: '日用品', color: '#7a9a2e', order: 2 },
  { id: 'transport', name: '交通・旅行', color: '#3f7fbf', order: 3 },
  { id: 'dining', name: '外食', color: '#d9733f', order: 4 },
  { id: 'hobby', name: '趣味・娯楽', color: '#1f9e9a', order: 5 },
  { id: 'convenience', name: 'コンビニ', color: '#c99a1e', order: 6 },
  { id: 'shopping', name: 'ショッピング', color: '#cc5f8a', order: 7 },
  { id: 'tax', name: '税金・公共料金', color: '#55615b', order: 8 },
  { id: 'other', name: 'その他', color: '#98a294', order: 9 },
  { id: UNCATEGORIZED, name: '未分類', color: '#d5dad1', order: 99 },
]

/** 統合により廃止したカテゴリ → 統合先 */
export const MERGED_CATEGORIES: Record<string, string> = {
  food: 'supermarket',
  medical: 'drugstore',
  digital: 'hobby',
  travel: 'transport',
  furusato: 'other',
}

/** カテゴリ追加・色変更時の色候補（検証済みの色を共用する） */
export const EXTRA_COLORS = DEFAULT_CATEGORIES.map((c) => c.color)

export const KIND_LABEL: Record<TxKind, string> = {
  payment: '支払い',
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
  'refund',
  'charge',
  'transfer_out',
  'transfer_in',
  'point',
  'investment',
  'withdrawal',
  'unknown',
]
