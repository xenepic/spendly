import type { Category, TxKind } from './types'

export const UNCATEGORIZED = 'uncategorized'

/**
 * 初期カテゴリ（9カテゴリ＋その他・未分類）。
 * 8色の色相は色覚多様性を考慮した検証（隣接する色どうしの CVD ΔE ≥ 8・通常視 ΔE ≥ 15）を通した組み合わせで、
 * ドーナツグラフはこの order の順に並べるため、隣り合う色が常に見分けやすくなる。
 * 税金・その他・未分類は、色付きのカテゴリより目立たない明度の異なるグレーにしている。
 */
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'supermarket', name: 'スーパー・食品', color: '#2e8058', emoji: '🛒', order: 0 },
  { id: 'drugstore', name: 'ドラッグストア・医療', color: '#8a6bc9', emoji: '💊', order: 1 },
  { id: 'daily', name: '日用品', color: '#7a9a2e', emoji: '🧻', order: 2 },
  { id: 'transport', name: '交通・旅行', color: '#3f7fbf', emoji: '🚃', order: 3 },
  { id: 'dining', name: '外食', color: '#d9733f', emoji: '🍝', order: 4 },
  { id: 'hobby', name: '趣味・娯楽', color: '#1f9e9a', emoji: '🎮', order: 5 },
  { id: 'convenience', name: 'コンビニ', color: '#c99a1e', emoji: '🏪', order: 6 },
  { id: 'shopping', name: 'ショッピング', color: '#cc5f8a', emoji: '🛍️', order: 7 },
  { id: 'tax', name: '税金・公共料金', color: '#55615b', emoji: '🧾', order: 8 },
  { id: 'other', name: 'その他', color: '#98a294', emoji: '📦', order: 9 },
  { id: UNCATEGORIZED, name: '未分類', color: '#d5dad1', emoji: '❔', order: 99 },
]

/** 絵文字が未設定のカテゴリに使う絵文字 */
export const DEFAULT_EMOJI = '🏷️'

/** カテゴリ追加・変更時の絵文字候補 */
export const EMOJI_CHOICES = [
  '🛒', '🍝', '🍣', '🍜', '🍔', '☕', '🍰', '🍺', '🏪', '🥬',
  '💊', '🏥', '🧻', '🧴', '🧺', '🏠', '💡', '📱', '💻', '🧾',
  '🚃', '🚕', '🚗', '⛽', '✈️', '🏨', '🎮', '🎬', '🎵', '📚',
  '🛍️', '👕', '💄', '🎁', '🐾', '👶', '🎓', '💪', '💰', '📦',
]

/** 入力文字列の先頭1文字（書記素単位。🛍️ や 👨‍👩‍👧 も1文字として扱う） */
export function firstGrapheme(text: string): string {
  const t = text.trim()
  if (!t) return ''
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const seg = new Intl.Segmenter('ja', { granularity: 'grapheme' }).segment(t)
    return seg[Symbol.iterator]().next().value?.segment ?? ''
  }
  return [...t][0]
}

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
