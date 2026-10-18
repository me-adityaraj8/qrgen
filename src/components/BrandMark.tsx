import { useId } from 'react'

/** Four rounded squares (a stylised QR grid) in the violet-to-blue brand gradient. */
export function BrandMark({ size = 30 }: { size?: number }) {
  const gradient = useId()
  const paint = `url(#${gradient})`
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false" className="brand-mark">
      <defs>
        <linearGradient id={gradient} x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#a78bfa" />
          <stop offset="0.5" stopColor="#7c3aed" />
          <stop offset="1" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      <g fill="none" stroke={paint} strokeWidth="3">
        <rect x="3.5" y="3.5" width="10.5" height="10.5" rx="3" />
        <rect x="18" y="3.5" width="10.5" height="10.5" rx="3" />
        <rect x="3.5" y="18" width="10.5" height="10.5" rx="3" />
      </g>
      <rect x="18" y="18" width="10.5" height="10.5" rx="3" fill={paint} />
    </svg>
  )
}
