'use client'

import { useEffect, useRef, useState } from 'react'

const prefersReducedMotion =
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false

/**
 * Animates a numeric value from 0 (or its previous value) to `target`
 * using an ease-out-cubic easing. Respects prefers-reduced-motion.
 */
export function useCountUp(target: number, duration = 650): number {
  const [displayed, setDisplayed] = useState(0)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)
  const fromRef = useRef<number>(0)

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplayed(target)
      return
    }

    fromRef.current = displayed
    startRef.current = null

    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    const animate = (timestamp: number) => {
      if (!startRef.current) startRef.current = timestamp
      const elapsed = timestamp - startRef.current
      const progress = Math.min(elapsed / duration, 1)
      // ease-out-cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayed(Math.round(fromRef.current + (target - fromRef.current) * eased))
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      }
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
    // Intentionally omit `displayed` from deps — we only want to animate when `target` changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration])

  return displayed
}
