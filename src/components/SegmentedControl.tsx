import { useId, type CSSProperties } from 'react'

export interface SegmentOption<T extends string> {
  value: T
  label: string
  /** Accessible name when the visible label is terse (e.g. "L"). */
  ariaLabel?: string
}

interface SegmentedControlProps<T extends string> {
  legend: string
  /** Keep the legend for assistive tech only (when a panel title already says it). */
  hideLegend?: boolean
  options: readonly SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  hint?: string
  className?: string
}

/**
 * Native radio group styled as a segmented control. Arrow keys move between
 * options; a single indicator slides to the selected option.
 */
export function SegmentedControl<T extends string>({
  legend,
  hideLegend,
  options,
  value,
  onChange,
  hint,
  className,
}: SegmentedControlProps<T>) {
  const name = useId()
  const hintId = useId()
  const selected = options.findIndex((option) => option.value === value)
  const style = { '--count': options.length, '--index': Math.max(0, selected) } as CSSProperties

  return (
    <fieldset className={`segmented-field${className ? ` ${className}` : ''}`} aria-describedby={hint ? hintId : undefined}>
      <legend className={hideLegend ? 'sr-only' : 'field-label'}>{legend}</legend>
      <div className="segmented" style={style}>
        <span className="segmented-indicator" aria-hidden="true" hidden={selected < 0} />
        {options.map((option) => (
          <label key={option.value} className="segment">
            <input
              type="radio"
              className="segment-input"
              name={name}
              value={option.value}
              checked={value === option.value}
              aria-label={option.ariaLabel}
              onChange={() => onChange(option.value)}
            />
            <span className="segment-label" aria-hidden={option.ariaLabel ? true : undefined}>
              {option.label}
            </span>
          </label>
        ))}
      </div>
      {hint && (
        <p id={hintId} className="segmented-hint">
          {hint}
        </p>
      )}
    </fieldset>
  )
}
