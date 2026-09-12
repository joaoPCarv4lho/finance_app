export default function ProgressBar({ percent }) {
  const pct = Math.min(Math.max(Number(percent) || 0, 0), 100)
  return (
    <div className="progress">
      <span style={{ width: `${pct}%` }} />
    </div>
  )
}
