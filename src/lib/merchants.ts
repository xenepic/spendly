import type { MerchantRule } from './types'

/** 照合用キー: 全角半角統一・小文字化・空白とハイフン類の除去 */
export function matchKey(name: string): string {
  return name
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s　\-‐‑–—−・･.。'’!！]/g, '')
}

/** 表示用の取引先名: 全角英数・空白のみ統一し、それ以外は元の表記を保つ */
export function displayName(name: string): string {
  const n = name.normalize('NFKC').replace(/\s+/g, ' ').trim()
  return n || '（取引先なし）'
}

interface BuiltinRule {
  re: RegExp
  merchant?: string
  category: string
}

/**
 * 組み込みの店舗統合・カテゴリ判定ルール。matchKey() 済みの文字列に対して先頭から評価する。
 * merchant を指定したルールは表記揺れ・店舗別の名称を1つの店舗名に統合する。
 */
const BUILTIN_RULES: BuiltinRule[] = [
  // コンビニ
  { re: /セブンー?イレブン|7eleven|seveneleven/, merchant: 'セブンイレブン', category: 'convenience' },
  { re: /ファミリーマート|ファミマ|familymart/, merchant: 'ファミリーマート', category: 'convenience' },
  { re: /ローソン|lawson/, merchant: 'ローソン', category: 'convenience' },
  { re: /ミニストップ|ministop/, merchant: 'ミニストップ', category: 'convenience' },
  { re: /デイリーヤマザキ|ヤマザキデイリー/, merchant: 'デイリーヤマザキ', category: 'convenience' },
  { re: /セイコーマート/, merchant: 'セイコーマート', category: 'convenience' },
  { re: /newdays|ニューデイズ/, merchant: 'NewDays', category: 'convenience' },
  { re: /キヨスク|kiosk/, category: 'convenience' },
  // 百貨店・商業施設（交通系より先に評価）
  { re: /伊勢丹/, category: 'shopping' },
  { re: /高島屋|大丸|阪急百貨店|阪神百貨店|近鉄百貨店|三越|松坂屋|そごう|西武百貨店/, category: 'shopping' },
  { re: /東急プラザ|ルミネ|パルコ|parco|オーパ|マルイ|0101|ルクア|グランスタ|gransta|ポルタ|asty|ホワイティ/, category: 'shopping' },
  // スーパー
  { re: /まいばすけっと/, merchant: 'まいばすけっと', category: 'supermarket' },
  { re: /マックスバリュ/, merchant: 'マックスバリュ', category: 'supermarket' },
  { re: /^イオン(?!銀行|シネマ|モール)|^aeon(?!bank)/, merchant: 'イオン', category: 'supermarket' },
  { re: /業務スーパー/, merchant: '業務スーパー', category: 'supermarket' },
  { re: /フレスコ/, merchant: 'フレスコ', category: 'supermarket' },
  { re: /新鮮激安市場/, merchant: '新鮮激安市場', category: 'supermarket' },
  { re: /^ライフ(?!スタイル)|ライフコーポレーション/, merchant: 'ライフ', category: 'supermarket' },
  { re: /西友|seiyu/, merchant: '西友', category: 'supermarket' },
  { re: /イトーヨーカドー|ヨーカドー/, merchant: 'イトーヨーカドー', category: 'supermarket' },
  { re: /成城石井/, merchant: '成城石井', category: 'supermarket' },
  { re: /マルエツ|サミットストア|万代|平和堂|イズミヤ|阪急オアシス|ダイエー|関西スーパー|東急ストア|オオゼキ|ヤオコー|コープ|生協|ロピア|オーケーストア|トライアル/, category: 'supermarket' },
  // ドラッグストア
  { re: /スギ薬局|スギドラッグ/, merchant: 'スギ薬局', category: 'drugstore' },
  { re: /マツモトキヨシ|マツキヨ|matsukiyo/, merchant: 'マツモトキヨシ', category: 'drugstore' },
  { re: /ウエルシア|ハックドラッグ/, merchant: 'ウエルシア', category: 'drugstore' },
  { re: /ココカラファイン/, merchant: 'ココカラファイン', category: 'drugstore' },
  { re: /ツルハ/, merchant: 'ツルハドラッグ', category: 'drugstore' },
  { re: /サンドラッグ/, merchant: 'サンドラッグ', category: 'drugstore' },
  { re: /ドラッグ|薬局|ドラックストア/, category: 'drugstore' },
  // 外食・デリバリー
  { re: /出前館/, merchant: '出前館', category: 'dining' },
  { re: /ubereats|ウーバーイーツ/, merchant: 'Uber Eats', category: 'dining' },
  { re: /マクドナルド|mcdonald/, merchant: 'マクドナルド', category: 'dining' },
  { re: /スターバックス|starbucks/, merchant: 'スターバックス', category: 'dining' },
  { re: /すき家|吉野家|松屋|なか卯|ガスト|サイゼリヤ|ドトール|タリーズ|コメダ|天下一品|モスバーガー|ケンタッキー|くら寿司|スシロー|はま寿司|丸亀製麺|ミスタードーナツ|ココイチ|coco壱|大戸屋|バーミヤン|ジョナサン|鳥貴族|餃子の王将|一蘭|勝牛|kichiri|杉玉|ドーナツ|donuts|ラーメン|居酒屋|焼鳥|寿司|鮨|カフェ|cafe|食堂|酒場|茶房|レストラン|トラットリア|kitchen|bakery|ベーカリー|お好み焼|串焼/, category: 'dining' },
  // 日用品
  { re: /ダイソー|daiso/, merchant: 'ダイソー', category: 'daily' },
  { re: /ニトリ|デコホーム/, merchant: 'ニトリ', category: 'daily' },
  { re: /無印良品|muji/, merchant: '無印良品', category: 'daily' },
  { re: /セリア|キャンドゥ|ワッツ|ロフト|ハンズ|カインズ|コーナン|ホームセンター/, category: 'daily' },
  // ショッピング
  { re: /amazon|アマゾン/, merchant: 'Amazon', category: 'shopping' },
  { re: /ユニクロ|uniqlo|^gu$|ドスパラ|ヨドバシ|ビックカメラ|エディオン|ジョーシン|ケーズデンキ|楽天/, category: 'shopping' },
  // デジタル
  { re: /ブックライブ|booklive|dlsite|kindle|steam|apple|googleplay|netflix|spotify|nintendo|playstation/, category: 'digital' },
  // 趣味・娯楽
  { re: /第一興商|ビッグエコー|カラオケ|ジャンカラ|ラウンドワン|映画|シネマ|toho|ワイナリー|ミュージアム|美術館|博物館/, category: 'hobby' },
  // 交通
  { re: /タクシー|交通|^jr|鉄道|電鉄|バス$|市バス|高速バス|^go$|sride|新幹線/, category: 'transport' },
  // 医療
  { re: /病院|医院|クリニック|歯科|調剤/, category: 'medical' },
  // ふるさと納税
  { re: /さとふる|ふるさと/, category: 'furusato' },
]

export interface Resolved {
  merchant: string
  /** 組み込みルールから推定したカテゴリ（なければ undefined） */
  builtinCategory?: string
}

/** 取引先名から正規化した店舗名と推定カテゴリを求める。元の取引先名は変更しない */
export function resolveMerchant(payee: string, userRules: MerchantRule[] = []): Resolved {
  const key = matchKey(payee)
  for (const r of sortRules(userRules)) {
    const p = matchKey(r.pattern)
    if (!p) continue
    if (r.match === 'exact' ? key === p : key.includes(p)) {
      return { merchant: r.merchant, builtinCategory: builtinCategoryOf(r.merchant) }
    }
  }
  for (const r of BUILTIN_RULES) {
    if (r.re.test(key)) return { merchant: r.merchant ?? displayName(payee), builtinCategory: r.category }
  }
  return { merchant: displayName(payee) }
}

/** ユーザールールの評価順: 完全一致 → 部分一致、同じ条件では新しいものを優先 */
export function sortRules(rules: MerchantRule[]): MerchantRule[] {
  return [...rules].sort(
    (a, b) => (a.match === b.match ? 0 : a.match === 'exact' ? -1 : 1) || b.createdAt.localeCompare(a.createdAt),
  )
}

/** 正規化済み店舗名に対する組み込みカテゴリ */
export function builtinCategoryOf(merchant: string): string | undefined {
  const key = matchKey(merchant)
  return BUILTIN_RULES.find((r) => r.re.test(key))?.category
}
