// Tiny dependency-free confetti burst for celebratory moments (goal reached).
// Honors prefers-reduced-motion by doing nothing.
const COLORS = ['#10b981', '#f59e0b', '#6366f1', '#34d399', '#fbbf24']

export function burstConfetti(count = 44) {
  if (
    typeof window === 'undefined' ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  ) {
    return
  }

  const container = document.createElement('div')
  container.setAttribute('aria-hidden', 'true')
  Object.assign(container.style, {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    zIndex: '9999',
    overflow: 'hidden',
  })
  document.body.appendChild(container)

  const originX = window.innerWidth / 2
  const originY = window.innerHeight * 0.4

  for (let i = 0; i < count; i++) {
    const p = document.createElement('div')
    const size = 6 + Math.random() * 6
    Object.assign(p.style, {
      position: 'absolute',
      left: `${originX}px`,
      top: `${originY}px`,
      width: `${size}px`,
      height: `${size * 0.6}px`,
      background: COLORS[i % COLORS.length],
      borderRadius: '2px',
      opacity: '1',
    })
    container.appendChild(p)

    const angle = Math.random() * Math.PI * 2
    const velocity = 120 + Math.random() * 220
    const dx = Math.cos(angle) * velocity
    const dy = Math.sin(angle) * velocity - 260 // bias upward
    const rot = (Math.random() * 720 - 360).toFixed(0)
    const duration = 900 + Math.random() * 700

    p.animate(
      [
        { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
        {
          transform: `translate(${dx}px, ${dy + 320}px) rotate(${rot}deg)`,
          opacity: 0,
        },
      ],
      { duration, easing: 'cubic-bezier(0.15, 0.6, 0.4, 1)', fill: 'forwards' }
    )
  }

  setTimeout(() => container.remove(), 1800)
}
