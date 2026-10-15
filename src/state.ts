import type { TxKind } from './lib/types'

export type View = 'dashboard' | 'analysis' | 'transactions' | 'manage' | 'data'

export const VIEW_TITLE: Record<View, string> = {
  dashboard: 'ダッシュボード',
  analysis: '詳細分析',
  transactions: '取引一覧',
  manage: '店舗・カテゴリ',
  data: 'CSV取り込み・データ管理',
}

export type KindFilter = 'spending' | 'all' | TxKind

export interface TxFilter {
  query: string
  categoryId: string | null
  merchant: string | null
  /** 'month' は画面上部で選択中の月、'all' は全期間 */
  period: 'month' | 'all'
  bandId: string | null
  kind: KindFilter
}

export const EMPTY_FILTER: TxFilter = {
  query: '',
  categoryId: null,
  merchant: null,
  period: 'month',
  bandId: null,
  kind: 'spending',
}
