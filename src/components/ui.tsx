import { useId, type CSSProperties, type InputHTMLAttributes, type ReactNode, type Ref } from 'react'

/** Numbered section card: "1  Choose QR Type / Select what you want to encode". */
export function StepCard({
  step,
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  step: number
  title: string
  subtitle: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  const titleId = useId()
  return (
    <section className={`card${className ? ` ${className}` : ''}`} aria-labelledby={titleId}>
      <header className="card-head">
        <span className="step" aria-hidden="true">
          {step}
        </span>
        <div className="card-heading">
          <h2 id={titleId} className="card-title">
            {title}
          </h2>
          <p className="card-subtitle">{subtitle}</p>
        </div>
        {actions && <div className="card-actions">{actions}</div>}
      </header>
      {children}
    </section>
  )
}

/** Inner panel inside a card (Style, Colors, Size…). */
export function Panel({ icon, title, children, className }: { icon: ReactNode; title: string; children: ReactNode; className?: string }) {
  const titleId = useId()
  return (
    <div className={`panel${className ? ` ${className}` : ''}`} role="group" aria-labelledby={titleId}>
      <div className="panel-head">
        <span className="panel-icon" aria-hidden="true">
          {icon}
        </span>
        <h3 id={titleId} className="panel-title">
          {title}
        </h3>
      </div>
      {children}
    </div>
  )
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  ref?: Ref<HTMLInputElement>
  label: string
  error?: string
  hint?: string
  icon?: ReactNode
  trailing?: ReactNode
}

/** Labelled text input with an optional leading icon, trailing control and error. */
export function Field({ ref, label, error, hint, icon, trailing, id, className, ...input }: FieldProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const messageId = `${inputId}-message`
  return (
    <div className={`field${className ? ` ${className}` : ''}`}>
      <label htmlFor={inputId} className="field-label">
        {label}
      </label>
      <div className={`input-shell${error ? ' is-invalid' : ''}`}>
        {icon && (
          <span className="input-icon" aria-hidden="true">
            {icon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          className="input"
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? messageId : undefined}
          spellCheck={false}
          autoComplete="off"
          {...input}
        />
        {trailing}
      </div>
      {(error || hint) && (
        <p id={messageId} className={`field-note${error ? ' is-error' : ''}`} role={error ? 'alert' : undefined}>
          {error ?? hint}
        </p>
      )}
    </div>
  )
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <label className={`switch${disabled ? ' is-disabled' : ''}`}>
      <input
        type="checkbox"
        role="switch"
        className="switch-input"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="switch-track" aria-hidden="true">
        <span className="switch-thumb" />
      </span>
      <span className="switch-label">{label}</span>
    </label>
  )
}

/** Range input with a filled track and labelled tick marks. */
export function Slider({
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
  ticks,
  valueText,
}: {
  label: string
  min: number
  max: number
  step?: number
  value: number
  onChange: (value: number) => void
  ticks?: { value: number; label: string }[]
  valueText?: string
}) {
  const percent = ((value - min) / (max - min)) * 100
  return (
    <div className="slider" style={{ '--fill': `${percent}%` } as CSSProperties}>
      <input
        type="range"
        className="slider-input"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        aria-valuetext={valueText}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {ticks && (
        <div className="slider-ticks" aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick.value} style={{ left: `${((tick.value - min) / (max - min)) * 100}%` }}>
              {tick.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

interface TextAreaFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  rows?: number
  placeholder?: string
  maxLength?: number
}

/** Multi-line field. Cmd/Ctrl+Enter submits the surrounding form. */
export function TextAreaField({ label, value, onChange, error, rows = 3, placeholder, maxLength }: TextAreaFieldProps) {
  const id = useId()
  const messageId = `${id}-message`
  return (
    <div className="field">
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <div className={`input-shell is-multiline${error ? ' is-invalid' : ''}`}>
        <textarea
          id={id}
          className="input textarea"
          rows={rows}
          value={value}
          placeholder={placeholder}
          maxLength={maxLength}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? messageId : undefined}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }
          }}
        />
      </div>
      {error && (
        <p id={messageId} className="field-note is-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
