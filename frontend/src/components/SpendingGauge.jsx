import { useEffect, useState } from 'react'
import { formatCurrency } from '../utils/format'
import { useCountUp } from '../hooks/useCountUp'

const STATE_COLOR = {
  ok: 'var(--primary)',
  warn: 'var(--gold)',
  over: 'var(--expense)',
}

// 270° gauge with a 90° gap centered at the bottom. pathLength=100 lets us
// work in percent: the arc occupies 75 of 100 units.
const ARC = 75
const CENTER = 100
const R = 82
const SW = 15

/**
 * Speedometer-style ceiling gauge. The arc fills with the proportion of the
 * monthly budget already spent; the centre shows how much is safe to spend
 * today. Color shifts emerald → amber → red as the budget is consumed.
 */
export default function SpendingGauge({
  spent,
  budget,
  todayValue,
  state = 'ok',
  subtitle,
}) {
  const ratio = budget > 0 ? Math.min(spent / budget, 1) : 0
  const fillTarget = ratio * ARC

  // Animate the arc growing from 0 on mount.
  const [fill, setFill] = useState(0)
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setFill(fillTarget)
      return
    }
    const id = requestAnimationFrame(() => setFill(fillTarget))
    return () => cancelAnimationFrame(id)
  }, [fillTarget])

  const animatedValue = useCountUp(Number(todayValue) || 0)

  return (
    <div className="gauge-wrap">
      <svg className="gauge-svg" viewBox="0 0 200 200" role="img"
        aria-label={`Você pode gastar ${formatCurrency(todayValue)} hoje`}>
        <circle
          className="gauge-track"
          cx="100" cy="100" r={R}
          fill="none" strokeWidth={SW} strokeLinecap="round"
          pathLength={CENTER}
          strokeDasharray={`${ARC} ${CENTER}`}
          transform="rotate(135 100 100)"
        />
        <circle
          className="gauge-fill"
          cx="100" cy="100" r={R}
          fill="none" strokeWidth={SW} strokeLinecap="round"
          stroke={STATE_COLOR[state]}
          pathLength={CENTER}
          strokeDasharray={`${fill} ${CENTER}`}
          transform="rotate(135 100 100)"
        />
      </svg>
      <div className="gauge-center">
        <span className="gauge-label">Você pode gastar hoje</span>
        <span className="gauge-value tnum">{formatCurrency(animatedValue)}</span>
        {subtitle && <span className="gauge-sub">{subtitle}</span>}
      </div>
    </div>
  )
}
