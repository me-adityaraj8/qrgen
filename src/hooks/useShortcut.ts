import { useEffect, useState } from 'react'
import { getActionShortcut } from '../lib/chrome'

/** Current shortcut for opening the popup; see {@link getActionShortcut}. */
export function useShortcut(): string | null {
  const [shortcut, setShortcut] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    void getActionShortcut().then((value) => {
      if (!cancelled) setShortcut(value)
    })
    return () => {
      cancelled = true
    }
  }, [])
  return shortcut
}
