import { useEffect, useState } from 'react'
import { getActiveTabState } from '../lib/chrome'
import type { ActiveTabState } from '../types'

export function useActiveTab(): ActiveTabState {
  const [state, setState] = useState<ActiveTabState>({ status: 'loading' })
  useEffect(() => {
    let cancelled = false
    void getActiveTabState().then((next) => {
      if (!cancelled) setState(next)
    })
    return () => {
      cancelled = true
    }
  }, [])
  return state
}
