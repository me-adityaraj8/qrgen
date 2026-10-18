import { useSyncExternalStore } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

const subscribe = (onChange: () => void) => {
  if (typeof matchMedia !== 'function') return () => {}
  const media = matchMedia(QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

// Without matchMedia (tests, very old engines) behave as if motion is reduced.
const getSnapshot = () => typeof matchMedia !== 'function' || matchMedia(QUERY).matches

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => true)
}
