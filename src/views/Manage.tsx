import { useMemo, useState } from 'react'
import { byMerchant, isSpending } from '../lib/analytics'
import { EXTRA_COLORS, UNCATEGORIZED } from '../lib/categories'
import { db, newId } from '../lib/db'
import { yen } from '../lib/format'
import { builtinCategoryOf, matchKey, resolveMerchant } from '../lib/merchants'
import type { SpendlyData } from '../hooks/useData'
import { NoRows } from '../components/Empty'

type Tab = 'merchants' | 'categories' | 'rules'

interface Props {
  data: SpendlyData
  onMerchant: (name: string) => void
  onUnknown: () => void
}

export function Manage({ data, onMerchant, onUnknown }: Props) {
  const [tab, setTab] = useState<Tab>('merchants')
  const spend = useMemo(() => data.txs.filter(isSpending), [data.txs])
  const unknownCount = data.txs.filter((t) => t.effectiveKind === 'unknown').length
  const uncategorized = spend.filter((t) => t.categoryId === UNCATEGORIZED)

  return (
    <>
      <div className="mb-[14px] grid grid-cols-2 gap-3">
        <div className="card">
          <span className="caption">未分類の支出</span>
          <div className="value">{yen(uncategorized.reduce((a, t) => a + t.amount, 0))}</div>
          <span className="sub">
            {uncategorized.length}回 ・ {new Set(uncategorized.map((t) => t.merchant)).size}店舗
          </span>
        </div>
        <button className="card text-left transition-colors duration-150 enabled:hover:bg-hover-soft" onClick={onUnknown} disabled={!unknownCount}>
          <span className="caption">種別を判定できない取引</span>
          <div className="value">{unknownCount}件</div>
          <span className="sub">{unknownCount ? '取引一覧で確認 →' : '該当なし'}</span>
        </button>
      </div>

      <div className="mb-[14px] flex flex-wrap gap-[7px]" role="tablist">
        {(
          [
            ['merchants', '店舗'],
            ['categories', 'カテゴリ'],
            ['rules', '店舗名の統合ルール'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={`pill ${tab === id ? 'pill-active' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      <div key={tab} className="motion-safe:animate-appear">
        {tab === 'merchants' && <MerchantsTab data={data} onMerchant={onMerchant} />}
        {tab === 'categories' && <CategoriesTab data={data} />}
        {tab === 'rules' && <RulesTab data={data} />}
      </div>
    </>
  )
}

function MerchantsTab({ data, onMerchant }: { data: SpendlyData; onMerchant: (name: string) => void }) {
  const [query, setQuery] = useState('')
  const [onlyUncat, setOnlyUncat] = useState(false)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [limit, setLimit] = useState(50)
  const spend = useMemo(() => data.txs.filter(isSpending), [data.txs])
  const rows = useMemo(() => byMerchant(spend), [spend])
  const payeesOf = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const t of data.txs) {
      if (!m.has(t.merchant)) m.set(t.merchant, new Set())
      m.get(t.merchant)!.add(t.payee)
    }
    return m
  }, [data.txs])
  const mMap = useMemo(() => new Map(data.merchants.map((m) => [m.name, m])), [data.merchants])
  const q = matchKey(query)
  const shown = rows.filter((r) => (!onlyUncat || r.categoryId === UNCATEGORIZED) && (!q || matchKey(r.key).includes(q)))

  const setMerchantCategory = (name: string, categoryId: string) =>
    categoryId === '' ? db.merchants.update(name, { manual: false }) : db.merchants.put({ name, categoryId, manual: true })

  const rename = async (from: string) => {
    const to = newName.trim()
    setRenaming(null)
    if (!to || to === from) return
    const payees = [...(payeesOf.get(from) ?? [])]
    await db.transaction('rw', db.merchantRules, db.merchants, async () => {
      // 既存の同名パターンは置き換える
      const existing = await db.merchantRules.toArray()
      const keys = new Set(payees.map(matchKey))
      await db.merchantRules.bulkDelete(existing.filter((r) => r.match === 'exact' && keys.has(matchKey(r.pattern))).map((r) => r.id))
      await db.merchantRules.bulkAdd(
        payees.map((p) => ({ id: newId(), pattern: p, match: 'exact' as const, merchant: to, createdAt: new Date().toISOString() })),
      )
      const old = await db.merchants.get(from)
      const target = await db.merchants.get(to)
      if (old && !target) await db.merchants.put({ ...old, name: to })
    })
  }

  return (
    <div className="card">
      <div className="cardhead flex-wrap">
        <div>
          <h2>店舗ごとのカテゴリ</h2>
          <p className="meta">店舗のカテゴリを変更すると、その店舗の全取引に反映されます（取引単位で変更したものを除く）。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-legend">
            <input type="checkbox" checked={onlyUncat} onChange={(e) => setOnlyUncat(e.target.checked)} className="accent-brand" />
            未分類のみ
          </label>
          <input className="input w-[200px]" placeholder="店舗名で検索" aria-label="店舗検索" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>
      {shown.length === 0 ? (
        <NoRows text="該当する店舗はありません" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] border-collapse">
            <thead>
              <tr>
                <th className="th">店舗</th>
                <th className="th">元の取引先名</th>
                <th className="th">カテゴリ</th>
                <th className="th text-right!">回数</th>
                <th className="th text-right!">合計</th>
              </tr>
            </thead>
            <tbody>
              {shown.slice(0, limit).map((r) => {
                const stored = mMap.get(r.key)
                const payees = [...(payeesOf.get(r.key) ?? [])]
                return (
                  <tr key={r.key}>
                    <td className="td">
                      {renaming === r.key ? (
                        <form
                          className="flex gap-1"
                          onSubmit={(e) => {
                            e.preventDefault()
                            rename(r.key)
                          }}
                        >
                          <input className="input w-[150px] py-1.5!" autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} list="merchant-names" aria-label="新しい店舗名" />
                          <button className="control control-primary py-1.5!">保存</button>
                          <button type="button" className="control py-1.5!" onClick={() => setRenaming(null)}>
                            取消
                          </button>
                        </form>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button className="border-0 bg-transparent p-0 text-left text-xs font-bold text-ink hover:text-brand" onClick={() => onMerchant(r.key)}>
                            {r.key}
                          </button>
                          <button
                            className="border-0 bg-transparent p-0 text-[10px] text-faint hover:text-brand"
                            onClick={() => {
                              setRenaming(r.key)
                              setNewName(r.key)
                            }}
                          >
                            名前変更・統合
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="td max-w-[220px] text-[11px] text-faint">
                      <span className="line-clamp-2">{payees.join('、')}</span>
                    </td>
                    <td className="td">
                      <select
                        className="select py-1.5!"
                        aria-label={`${r.key}のカテゴリ`}
                        value={stored?.manual ? stored.categoryId : ''}
                        onChange={(e) => setMerchantCategory(r.key, e.target.value)}
                      >
                        <option value="">自動（{data.catMap.get(autoCategory(data, r.key, payees))?.name ?? '未分類'}）</option>
                        {data.categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="td text-right tabular-nums">{r.count}回</td>
                    <td className="td text-right font-bold tabular-nums">{yen(r.amount)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <datalist id="merchant-names">
            {rows.map((r) => (
              <option key={r.key} value={r.key} />
            ))}
          </datalist>
        </div>
      )}
      {shown.length > limit && (
        <button className="control mt-3" onClick={() => setLimit((l) => l + 50)}>
          さらに表示（残り{shown.length - limit}店舗）
        </button>
      )}
      <p className="caption mt-3">
        「名前変更・統合」で既存の店舗名を入力すると、その店舗に統合されます。設定は「店舗名の統合ルール」に保存されます。
      </p>
    </div>
  )
}

/** 手動設定をしない場合に適用されるカテゴリ（組み込みルールによる推定） */
function autoCategory(data: SpendlyData, merchant: string, payees: string[]) {
  return (
    payees.map((p) => resolveMerchant(p, data.rules).builtinCategory).find(Boolean) ??
    builtinCategoryOf(merchant) ??
    UNCATEGORIZED
  )
}

function CategoriesTab({ data }: { data: SpendlyData }) {
  const [name, setName] = useState('')
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of data.txs) if (isSpending(t)) m.set(t.categoryId, (m.get(t.categoryId) ?? 0) + 1)
    return m
  }, [data.txs])
  const palette = [...new Set([...data.categories.map((c) => c.color), ...EXTRA_COLORS])]

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    const n = name.trim()
    if (!n || data.categories.some((c) => c.name === n)) return
    const order = Math.max(0, ...data.categories.filter((c) => c.id !== UNCATEGORIZED).map((c) => c.order)) + 1
    const used = new Set(data.categories.map((c) => c.color))
    await db.categories.add({ id: newId(), name: n, color: EXTRA_COLORS.find((c) => !used.has(c)) ?? EXTRA_COLORS[0], order })
    setName('')
  }

  const remove = async (id: string, label: string) => {
    if (!confirm(`カテゴリ「${label}」を削除しますか？\nこのカテゴリの店舗・取引は自動判定（判定できない場合は未分類）に戻ります。`)) return
    await db.transaction('rw', db.categories, db.merchants, db.txOverrides, async () => {
      await db.categories.delete(id)
      await db.merchants.where('categoryId').equals(id).modify({ manual: false, categoryId: UNCATEGORIZED })
      await db.txOverrides.filter((o) => o.categoryId === id).modify((o) => void delete o.categoryId)
    })
  }

  return (
    <div className="card">
      <div className="cardhead flex-wrap">
        <h2>カテゴリ</h2>
        <form className="flex gap-2" onSubmit={add}>
          <input className="input w-[180px]" placeholder="新しいカテゴリ名" aria-label="新しいカテゴリ名" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="control control-primary" disabled={!name.trim()}>
            追加
          </button>
        </form>
      </div>
      {data.categories.map((c) => (
        <div key={c.id} className="flex flex-wrap items-center gap-3 border-b border-line-soft py-[10px]">
          <span className="dot h-4! w-4! rounded-[5px]!" style={{ background: c.color }} />
          {c.id === UNCATEGORIZED ? (
            <span className="w-[180px] px-[11px] text-xs">{c.name}</span>
          ) : (
            <input
              className="input w-[180px] py-1.5!"
              defaultValue={c.name}
              aria-label="カテゴリ名"
              onBlur={(e) => {
                const v = e.target.value.trim()
                if (v && v !== c.name) db.categories.update(c.id, { name: v })
                else e.target.value = c.name
              }}
            />
          )}
          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={`${c.name}の色`}>
            {palette.map((col) => (
              <button
                key={col}
                role="radio"
                aria-checked={c.color === col}
                aria-label={col}
                onClick={() => db.categories.update(c.id, { color: col })}
                className={`h-5 w-5 rounded-md border-2 ${c.color === col ? 'border-ink' : 'border-transparent'}`}
                style={{ background: col }}
              />
            ))}
          </div>
          <span className="caption ml-auto">{counts.get(c.id) ?? 0}回</span>
          {c.id !== UNCATEGORIZED && (
            <button className="border-0 bg-transparent text-[11px] text-faint hover:text-up" onClick={() => remove(c.id, c.name)}>
              削除
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

function RulesTab({ data }: { data: SpendlyData }) {
  const [pattern, setPattern] = useState('')
  const [merchant, setMerchant] = useState('')
  const [match, setMatch] = useState<'contains' | 'exact'>('contains')
  const merchantNames = useMemo(() => [...new Set(data.txs.filter(isSpending).map((t) => t.merchant))].sort((a, b) => a.localeCompare(b, 'ja')), [data.txs])
  const affected = useMemo(() => {
    const p = matchKey(pattern)
    if (!p) return 0
    return new Set(data.txs.filter((t) => (match === 'exact' ? matchKey(t.payee) === p : matchKey(t.payee).includes(p))).map((t) => t.payee)).size
  }, [pattern, match, data.txs])

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pattern.trim() || !merchant.trim()) return
    await db.merchantRules.add({ id: newId(), pattern: pattern.trim(), match, merchant: merchant.trim(), createdAt: new Date().toISOString() })
    setPattern('')
    setMerchant('')
  }

  return (
    <div className="card">
      <div className="cardhead">
        <div>
          <h2>店舗名の統合ルール</h2>
          <p className="meta">CSVの取引先名を、指定した店舗名にまとめて集計します。元の取引先名は変更されません。「一致」のルールが「含む」より優先され、同じ条件では新しいルールが優先されます。</p>
        </div>
      </div>
      <form className="mb-4 flex flex-wrap items-center gap-2 rounded-[9px] bg-mini p-3 text-xs" onSubmit={add}>
        取引先名が
        <input className="input w-[160px] py-1.5!" value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="例: セブン" aria-label="取引先名のパターン" />
        <select className="select py-1.5!" value={match} onChange={(e) => setMatch(e.target.value as 'contains' | 'exact')} aria-label="一致条件">
          <option value="contains">を含む</option>
          <option value="exact">と一致</option>
        </select>
        場合、店舗名
        <input className="input w-[160px] py-1.5!" value={merchant} onChange={(e) => setMerchant(e.target.value)} list="rule-merchants" placeholder="統合後の店舗名" aria-label="統合後の店舗名" />
        <datalist id="rule-merchants">
          {merchantNames.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        にする
        <button className="control control-primary py-1.5!" disabled={!pattern.trim() || !merchant.trim()}>
          追加
        </button>
        {pattern.trim() && <span className="caption">該当する取引先名: {affected}件</span>}
      </form>
      {data.rules.length === 0 ? (
        <NoRows text="ルールはありません（組み込みルールで表記揺れを統合しています）" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse">
            <thead>
              <tr>
                <th className="th">取引先名</th>
                <th className="th">条件</th>
                <th className="th">店舗名</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody>
              {[...data.rules]
                .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
                .map((r) => (
                  <tr key={r.id}>
                    <td className="td">{r.pattern}</td>
                    <td className="td text-faint">{r.match === 'exact' ? '一致' : '含む'}</td>
                    <td className="td font-bold">{r.merchant}</td>
                    <td className="td">
                      <button className="border-0 bg-transparent text-[11px] text-faint hover:text-up" onClick={() => db.merchantRules.delete(r.id)}>
                        削除
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
