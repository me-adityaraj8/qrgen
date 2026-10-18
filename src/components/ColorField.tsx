import { useId, useState } from 'react'
import { normalizeHex } from '../lib/color'

interface ColorFieldProps {
  label: string
  /** Normalized `#rrggbb`. */
  value: string
  onChange: (hex: string) => void
}

/** Native color picker plus an editable hex field. Only valid colors are applied. */
export function ColorField({ label, value, onChange }: ColorFieldProps) {
  const inputId = useId()
  const errorId = useId()
  const [draft, setDraft] = useState(value)
  const [syncedValue, setSyncedValue] = useState(value)

  // Follow outside changes (picker, swap, reset) without clobbering a short
  // form the user is typing, e.g. "#abc" while the value is "#aabbcc".
  if (value !== syncedValue) {
    setSyncedValue(value)
    if (normalizeHex(draft) !== value) setDraft(value)
  }

  const digits = draft.trim().replace(/^#/, '')
  const invalid = normalizeHex(draft) === null && (/[^0-9a-f]/i.test(digits) || digits.length >= 6)

  const commitDraft = () => {
    // Snap back to the applied color so the field never shows a color that isn't used.
    setDraft(normalizeHex(draft) ?? value)
  }

  return (
    <div className="color-field">
      <label htmlFor={inputId} className="field-label">
        {label}
      </label>
      <div className={`color-control${invalid ? ' is-invalid' : ''}`}>
        <input
          type="color"
          className="color-swatch"
          value={value}
          aria-label={`${label} color picker`}
          onChange={(event) => onChange(event.target.value)}
        />
        <input
          id={inputId}
          type="text"
          className="color-hex"
          value={draft}
          maxLength={7}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          onChange={(event) => {
            setDraft(event.target.value)
            const hex = normalizeHex(event.target.value)
            if (hex) onChange(hex)
          }}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commitDraft()
          }}
        />
      </div>
      {invalid && (
        <p id={errorId} className="field-message is-error">
          Use a hex color like #1f2937.
        </p>
      )}
    </div>
  )
}
