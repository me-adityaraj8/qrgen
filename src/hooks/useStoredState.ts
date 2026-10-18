import { useCallback, useEffect, useRef, useState } from 'react'
import { readStorage, removeStorage, writeStorage } from '../lib/chrome'

/**
 * State mirrored to chrome.storage.local (`null` removes the key). Writes happen
 * immediately because the popup can close at any moment.
 */
export function useStoredState<T>(key: string, fallback: T, sanitize: (value: unknown) => T) {
  const [value, setValue] = useState<T>(fallback)
  const [ready, setReady] = useState(false)
  const current = useRef(fallback)
  const sanitizeRef = useRef(sanitize)

  useEffect(() => {
    let cancelled = false
    void readStorage(key).then((stored) => {
      if (cancelled) return
      if (stored !== undefined) {
        current.current = sanitizeRef.current(stored)
        setValue(current.current)
      }
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [key])

  const update = useCallback(
    (next: T | ((previous: T) => T)) => {
      const resolved = typeof next === 'function' ? (next as (previous: T) => T)(current.current) : next
      current.current = resolved
      setValue(resolved)
      const write = resolved === null ? removeStorage(key) : writeStorage(key, resolved)
      write.catch(() => {
        // Storage is a convenience; the popup keeps working without it.
      })
    },
    [key],
  )

  return [value, update, ready] as const
}
