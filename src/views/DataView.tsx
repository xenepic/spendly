import { useMemo, useRef, useState } from 'react'
import { clearAll, exportBackup, resetClassification, restoreBackup } from '../lib/backup'
import { clearPersistentState } from '../hooks/usePersistentState'
import { DEFAULT_CATEGORIES, KIND_LABEL, KIND_ORDER } from '../lib/categories'
import { db } from '../lib/db'
import { dateTime, yen } from '../lib/format'
import { sum } from '../lib/analytics'
import type { SpendlyData } from '../hooks/useData'
import type { ImportResult } from '../hooks/useImporter'
import type { TxKind } from '../lib/types'

interface Props {
  data: SpendlyData
  busy: boolean
  results: ImportResult[]
  onFiles: (files: FileList | File[]) => void
  onKind: (k: TxKind) => void
}

const ENCODING_LABEL: Record<string, string> = { 'utf-8': 'UTF-8', 'utf-16le': 'UTF-16LE', 'utf-16be': 'UTF-16BE', shift_jis: 'Shift_JIS' }

export function DataView({ data, busy, results, onFiles, onKind }: Props) {
  const [drag, setDrag] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const restoreRef = useRef<HTMLInputElement>(null)

  const byKind = useMemo(
    () =>
      KIND_ORDER.map((k) => {
        const txs = data.txs.filter((t) => t.effectiveKind === k)
        return { kind: k, count: txs.length, amount: sum(txs) }
      }).filter((r) => r.count > 0),
    [data.txs],
  )

  const download = async () => {
    const b = await exportBackup(db)
    const blob = new Blob([JSON.stringify(b, null, 1)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `spendly-backup-${b.exportedAt.slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    setMessage({ ok: true, text: `バックアップを書き出しました（取引${b.tables.transactions.length}件）` })
  }

  const restore = async (file: File) => {
    try {
      const json = JSON.parse(await file.text())
      if (!confirm('現在のデータをすべて削除し、バックアップの内容で置き換えます。よろしいですか？')) return
      await restoreBackup(db, json)
      setMessage({ ok: true, text: `${file.name} から復元しました` })
    } catch (e) {
      setMessage({ ok: false, text: `復元できませんでした: ${(e as Error).message}` })
    }
  }

  const manualCount = data.merchants.filter((m) => m.manual).length + data.overrides.length + data.rules.length

  const resetView = () => {
    if (!confirm('タブ・絞り込み・並び順・表示中の画面などの選択状態を初期状態に戻します。よろしいですか？')) return
    clearPersistentState()
    location.reload()
  }

  const resetRules = async () => {
    if (
      !confirm(
        '分類設定を初期状態に戻します。\n・店舗ごとのカテゴリの手動設定\n・取引ごとのカテゴリ・種別の変更\n・店舗名の統合ルール\n・カテゴリの追加・名前・色の変更\n\n取引データと取り込み履歴は残ります。元に戻せません。よろしいですか？',
      )
    )
      return
    await resetClassification(db, DEFAULT_CATEGORIES)
    setMessage({ ok: true, text: '分類設定を初期状態に戻しました' })
  }

  const wipe = async () => {
    if (!confirm('取引・分類設定・取り込み履歴をすべて削除します。元に戻せません。よろしいですか？')) return
    await clearAll(db, DEFAULT_CATEGORIES)
    setMessage({ ok: true, text: 'すべてのデータを削除しました' })
  }

  return (
    <>
      <div
        className={`card mb-[14px] border-2 border-dashed text-center transition-colors duration-150 ${drag ? 'border-focus bg-hover' : 'border-[#dfe6dc]'}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          onFiles(e.dataTransfer.files)
        }}
      >
        <div className="py-8">
          <h2>PayPayの取引履歴CSVを取り込む</h2>
          <p className="meta">ファイルをここにドロップするか、選択してください（複数可）。UTF-8・UTF-16・Shift_JISに対応しています。</p>
          <button className="control control-primary mt-4" onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? '取り込み中…' : 'ファイルを選択'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) onFiles(e.target.files)
              e.target.value = ''
            }}
          />
          <p className="caption mt-4">CSVの解析と保存はこのブラウザ内で行い、外部には送信しません。同じ取引は重複して登録されません。</p>
        </div>
      </div>

      {results.length > 0 && (
        <div className="card mb-[14px] motion-safe:animate-appear" aria-live="polite">
          <div className="cardhead">
            <h2>取り込み結果</h2>
          </div>
          {results.map((r, i) =>
            r.ok ? (
              <div key={i} className="border-b border-line-soft py-3 text-xs last:border-0">
                <b>{r.fileName}</b>
                <span className="caption ml-2">
                  {r.history.format === 'official' ? '公式形式' : '旧形式'} ・ {ENCODING_LABEL[r.history.encoding] ?? r.history.encoding}
                  {r.history.periodFrom && ` ・ ${dateTime(r.history.periodFrom).slice(0, 10)}〜${dateTime(r.history.periodTo!).slice(0, 10)}`}
                </span>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <Stat label="読み込み行数" value={r.history.totalRows} />
                  <Stat label="新規登録" value={r.history.added} strong />
                  <Stat label="重複のため除外" value={r.history.duplicates} />
                  <Stat label="対象外（処理中）" value={r.history.skipped} />
                  <Stat label="要確認" value={r.history.unknown} warn={r.history.unknown > 0} />
                </div>
                {r.history.errors.length > 0 && (
                  <details className="mt-2 text-[11px] text-warn-text">
                    <summary>読み込めなかった行: {r.history.errors.length}件</summary>
                    <ul className="m-0 mt-1 pl-4">
                      {r.history.errors.slice(0, 50).map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            ) : (
              <div key={i} className="border-b border-line-soft py-3 text-xs last:border-0">
                <b>{r.fileName}</b>
                <p className="m-0 mt-1 text-warn-text">{r.error}</p>
              </div>
            ),
          )}
        </div>
      )}

      <div className="mb-[14px] grid gap-[14px] md:grid-cols-[.95fr_1.05fr]">
        <div className="card">
          <div className="cardhead">
            <h2>取引種別の内訳</h2>
            <span className="caption">全期間</span>
          </div>
          {byKind.length === 0 ? (
            <p className="caption">取引データがありません</p>
          ) : (
            byKind.map((r) => (
              <button
                key={r.kind}
                onClick={() => onKind(r.kind)}
                className="flex w-full items-center justify-between border-0 border-b border-solid border-line-soft bg-transparent px-[2px] py-[10px] text-left text-xs transition-colors duration-150 hover:bg-[#f6f8f4]"
              >
                <span>
                  <span className={r.kind === 'unknown' ? 'tag bg-warn-bg! text-warn-text!' : 'tag'}>{KIND_LABEL[r.kind]}</span>
                  <span className="ml-2 text-faint">{r.count}件</span>
                </span>
                <b className="tabular-nums">{yen(r.amount)}</b>
              </button>
            ))
          )}
          <p className="caption mt-3">支出の集計には「支払い」のみを含みます。請求書払い・税金（税金・年金・公共料金など）、チャージ・送金・返金・ポイント・ポイント運用は含みません。取引一覧で種別を変更すると集計に反映されます。</p>
        </div>

        <div className="card">
          <div className="cardhead">
            <h2>バックアップ</h2>
          </div>
          <p className="meta mt-0">取引データと分類設定をJSONファイルで書き出し・復元できます。</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="control control-primary" onClick={download}>
              JSONを書き出す
            </button>
            <button className="control" onClick={() => restoreRef.current?.click()}>
              JSONから復元
            </button>
            <input
              ref={restoreRef}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) restore(f)
                e.target.value = ''
              }}
            />
            <button className="control ml-auto text-up!" onClick={wipe}>
              すべて削除
            </button>
          </div>
          {message && (
            <p className={`mt-3 text-xs ${message.ok ? 'text-down' : 'text-warn-text'}`} role="status">
              {message.text}
            </p>
          )}
        </div>
      </div>

      <div className="card mb-[14px]">
        <div className="cardhead">
          <h2>設定のリセット</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-[9px] bg-mini p-4">
            <b className="text-xs">表示設定</b>
            <p className="caption mt-1 mb-3">タブ・チェック・絞り込み・並び順・表示中の画面と月の選択状態</p>
            <button className="control" onClick={resetView}>
              表示設定をリセット
            </button>
          </div>
          <div className="rounded-[9px] bg-mini p-4">
            <b className="text-xs">分類設定</b>
            <p className="caption mt-1 mb-3">
              店舗カテゴリの手動設定・取引ごとの変更・統合ルール・カテゴリ（現在{manualCount}件の手動設定）。取引データは残ります。
            </p>
            <button className="control text-up!" onClick={resetRules}>
              分類設定をリセット
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="cardhead">
          <h2>取り込み履歴</h2>
          <span className="caption">{data.histories.length}件</span>
        </div>
        {data.histories.length === 0 ? (
          <p className="caption">取り込み履歴はありません</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse">
              <thead>
                <tr>
                  <th className="th">取り込み日時</th>
                  <th className="th">ファイル</th>
                  <th className="th">取引期間</th>
                  <th className="th text-right!">行数</th>
                  <th className="th text-right!">新規</th>
                  <th className="th text-right!">重複</th>
                  <th className="th text-right!">エラー</th>
                </tr>
              </thead>
              <tbody>
                {data.histories.map((h) => (
                  <tr key={h.id}>
                    <td className="td whitespace-nowrap text-[#88978a] tabular-nums">{new Date(h.importedAt).toLocaleString('ja-JP')}</td>
                    <td className="td max-w-[200px] truncate">{h.fileName}</td>
                    <td className="td whitespace-nowrap tabular-nums">
                      {h.periodFrom ? `${h.periodFrom.slice(0, 10)}〜${h.periodTo?.slice(0, 10)}` : '—'}
                    </td>
                    <td className="td text-right tabular-nums">{h.totalRows}</td>
                    <td className="td text-right font-bold tabular-nums">{h.added}</td>
                    <td className="td text-right tabular-nums">{h.duplicates}</td>
                    <td className="td text-right tabular-nums">{h.errors.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

function Stat({ label, value, strong, warn }: { label: string; value: number; strong?: boolean; warn?: boolean }) {
  return (
    <div className="rounded-[9px] bg-mini px-3 py-2">
      <div className="caption">{label}</div>
      <div className={`mt-1 text-base tabular-nums ${strong ? 'font-extrabold' : 'font-bold'} ${warn ? 'text-warn-text' : ''}`}>{value}</div>
    </div>
  )
}
