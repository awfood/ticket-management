'use client'

import { createContext, useContext } from 'react'
import type { UserContext } from '@/types'

const UserCtx = createContext<UserContext | null>(null)

export function UserProvider({
  value,
  children,
}: {
  value: UserContext
  children: React.ReactNode
}) {
  return <UserCtx value={value}>{children}</UserCtx>
}

export function useUser(): UserContext {
  const ctx = useContext(UserCtx)
  if (!ctx) {
    throw new Error('useUser deve ser usado dentro de um UserProvider')
  }
  return ctx
}
