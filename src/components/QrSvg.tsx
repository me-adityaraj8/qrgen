import { memo, useId } from 'react'
import type { SvgSpec } from '../lib/render'

/**
 * Inline SVG of a QR spec: the same geometry the SVG and PNG exports use.
 * Colors are attributes so CSS can cross-fade them.
 */
export const QrSvg = memo(function QrSvg({ spec, label, className }: { spec: SvgSpec; label?: string; className?: string }) {
  const gradientId = useId()
  const paint = spec.fill.kind === 'solid' ? spec.fill.color : `url(#${gradientId})`
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      viewBox={`0 0 ${spec.canvas} ${spec.canvas}`}
      shapeRendering={spec.crisp ? 'crispEdges' : 'geometricPrecision'}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {spec.fill.kind === 'gradient' && (
        <defs>
          <linearGradient
            id={gradientId}
            gradientUnits="userSpaceOnUse"
            x1={spec.fill.x1}
            y1={spec.fill.y1}
            x2={spec.fill.x2}
            y2={spec.fill.y2}
          >
            <stop offset="0" stopColor={spec.fill.from} />
            <stop offset="1" stopColor={spec.fill.to} />
          </linearGradient>
        </defs>
      )}
      <rect className="qr-surface" width={spec.canvas} height={spec.canvas} fill={spec.background} />
      <path className="qr-modules" fill={paint} d={spec.modules} />
      {spec.eyes && <path className="qr-modules" fill={paint} fillRule="evenodd" d={spec.eyes} />}
      {spec.logo && (
        <image
          href={spec.logo.href}
          x={spec.logo.x}
          y={spec.logo.y}
          width={spec.logo.size}
          height={spec.logo.size}
          preserveAspectRatio="xMidYMid meet"
        />
      )}
    </svg>
  )
})
