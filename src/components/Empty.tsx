export function EmptyState({ onImport, message = '取引データがありません' }: { onImport?: () => void; message?: string }) {
  return (
    <div className="card flex flex-col items-center gap-4 py-14 text-center">
      <div className="grid h-11 w-11 place-items-center rounded-xl bg-avatar-bg text-lg text-avatar-text" aria-hidden>
        ◈
      </div>
      <div>
        <h2>{message}</h2>
        <p className="meta">PayPayアプリの取引履歴からダウンロードしたCSVを取り込むと集計が表示されます。</p>
      </div>
      {onImport && (
        <button className="control control-primary" onClick={onImport}>
          ＋ CSV追加
        </button>
      )}
    </div>
  )
}

export function NoRows({ text = '該当する取引はありません' }: { text?: string }) {
  return <p className="py-6 text-center text-xs text-faint">{text}</p>
}
