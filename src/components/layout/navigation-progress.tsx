'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

/**
 * Barra de progresso fina no topo da página.
 * Aparece durante transições de rota (estilo YouTube/NProgress).
 */
export function NavigationProgress() {
  const pathname = usePathname()
  const [state, setState] = useState<'idle' | 'loading' | 'completing'>('idle')
  const [progress, setProgress] = useState(0)
  const prevPathname = useRef(pathname)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (pathname === prevPathname.current) return
    prevPathname.current = pathname

    // Inicia o progresso
    setState('loading')
    setProgress(20)

    // Incrementa progressivamente (nunca chega a 100% até completar)
    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev
        return prev + Math.random() * 10
      })
    }, 300)

    // Completa após montagem da nova página
    const completeTimer = setTimeout(() => {
      if (timerRef.current) clearInterval(timerRef.current)
      setProgress(100)
      setState('completing')

      setTimeout(() => {
        setState('idle')
        setProgress(0)
      }, 200)
    }, 150)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      clearTimeout(completeTimer)
    }
  }, [pathname])

  if (state === 'idle') return null

  return (
    <div className="fixed inset-x-0 top-0 z-[60] h-0.5">
      <div
        className={cn(
          'h-full bg-primary transition-all',
          state === 'loading' && 'duration-300 ease-out',
          state === 'completing' && 'duration-200 ease-in'
        )}
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}
