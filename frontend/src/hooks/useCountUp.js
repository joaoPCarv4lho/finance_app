import { useEffect, useRef, useState } from 'react'

const prefersReduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Animate a number from 0 up to `target` (easeOutCubic). Honors
 * prefers-reduced-motion by jumping straight to the final value.
 */
export function useCountUp(target, duration = 750) {
  const [value, setValue] = useState(prefersReduced() ? target : 0)
  const raf = useRef()

  useEffect(() => {
    if (prefersReduced()) {
      setValue(target)
      return
    }
    const start = performance.now()
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(target * eased)
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target, duration])

  return value
}
