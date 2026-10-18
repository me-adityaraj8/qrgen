import { AppWindow, CircleAlert, CornerDownLeft, Eye, EyeOff, Info, Link2, X } from 'lucide-react'
import { useState, type FormEvent, type RefObject } from 'react'
import type { FieldError } from '../hooks/useGenerator'
import type { QrForms, QrType, WifiSecurity } from '../types'
import { SegmentedControl } from './SegmentedControl'
import { Field, Switch, TextAreaField } from './ui'

interface ContentFormProps {
  type: QrType
  forms: QrForms
  onChange: <T extends QrType>(type: T, patch: Partial<QrForms[T]>) => void
  onGenerate: () => void
  /** Present when the URL field can be reset to the current tab. */
  onUseCurrentTab?: () => void
  isCurrentTab: boolean
  error: FieldError
  notice: string | null
  capacity?: { used: number; max: number }
  urlInputRef: RefObject<HTMLInputElement | null>
}

const SECURITY_OPTIONS: { value: WifiSecurity; label: string; ariaLabel: string }[] = [
  { value: 'WPA', label: 'WPA', ariaLabel: 'WPA, WPA2 or WPA3' },
  { value: 'WEP', label: 'WEP', ariaLabel: 'WEP' },
  { value: 'nopass', label: 'None', ariaLabel: 'No password' },
]

const format = (n: number) => n.toLocaleString('en-US')

export function ContentForm({ type, forms, onChange, onGenerate, onUseCurrentTab, isCurrentTab, error, notice, capacity, urlInputRef }: ContentFormProps) {
  const [showPassword, setShowPassword] = useState(false)
  const errorFor = (field: string) => (error?.field === field ? error.message : undefined)
  const generalError = error && !error.field ? error.message : undefined

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    onGenerate()
  }

  return (
    <form className="content-form" onSubmit={handleSubmit} noValidate>
      {type === 'url' && (
        <div className="url-row">
          <Field
            ref={urlInputRef}
            label="Website URL"
            className="field-grow label-hidden"
            icon={<Link2 size={16} strokeWidth={1.8} />}
            value={forms.url.url}
            placeholder="https://example.com"
            inputMode="url"
            autoCapitalize="off"
            error={errorFor('url')}
            onChange={(event) => onChange('url', { url: event.target.value })}
            trailing={
              forms.url.url && (
                <button
                  type="button"
                  className="input-action"
                  aria-label="Clear URL"
                  onClick={() => {
                    onChange('url', { url: '' })
                    urlInputRef.current?.focus()
                  }}
                >
                  <X size={15} strokeWidth={2} />
                </button>
              )
            }
          />
          {onUseCurrentTab && (
            <button type="button" className="button button-secondary" onClick={onUseCurrentTab} disabled={isCurrentTab}>
              <AppWindow size={15} strokeWidth={1.8} />
              {isCurrentTab ? 'Current tab' : 'Use current tab'}
            </button>
          )}
        </div>
      )}

      {type === 'text' && (
        <TextAreaField
          label="Text"
          value={forms.text.text}
          placeholder="Anything you want to share"
          error={errorFor('text')}
          onChange={(text) => onChange('text', { text })}
        />
      )}

      {type === 'wifi' && (
        <div className="form-grid">
          <Field
            label="Network name (SSID)"
            value={forms.wifi.ssid}
            placeholder="Home network"
            error={errorFor('ssid')}
            onChange={(event) => onChange('wifi', { ssid: event.target.value })}
          />
          <Field
            label="Password"
            type={showPassword ? 'text' : 'password'}
            value={forms.wifi.password}
            disabled={forms.wifi.security === 'nopass'}
            placeholder={forms.wifi.security === 'nopass' ? 'Not needed' : '8 to 63 characters'}
            error={errorFor('password')}
            onChange={(event) => onChange('wifi', { password: event.target.value })}
            trailing={
              <button
                type="button"
                className="input-action"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                disabled={forms.wifi.security === 'nopass'}
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? <EyeOff size={15} strokeWidth={1.8} /> : <Eye size={15} strokeWidth={1.8} />}
              </button>
            }
          />
          <SegmentedControl<WifiSecurity>
            legend="Security"
            className="control-security"
            options={SECURITY_OPTIONS}
            value={forms.wifi.security}
            onChange={(security) => onChange('wifi', { security })}
          />
          <div className="switch-cell">
            <Switch checked={forms.wifi.hidden} onChange={(hidden) => onChange('wifi', { hidden })} label="Hidden network" />
          </div>
        </div>
      )}

      {type === 'contact' && (
        <div className="form-grid">
          <Field label="First name" value={forms.contact.firstName} autoComplete="given-name" error={errorFor('firstName')} onChange={(event) => onChange('contact', { firstName: event.target.value })} />
          <Field label="Last name" value={forms.contact.lastName} autoComplete="family-name" onChange={(event) => onChange('contact', { lastName: event.target.value })} />
          <Field label="Phone" type="tel" value={forms.contact.phone} placeholder="+1 555 010 9999" error={errorFor('phone')} onChange={(event) => onChange('contact', { phone: event.target.value })} />
          <Field label="Email" type="email" value={forms.contact.email} placeholder="name@example.com" error={errorFor('email')} onChange={(event) => onChange('contact', { email: event.target.value })} />
          <Field label="Organization" value={forms.contact.organization} onChange={(event) => onChange('contact', { organization: event.target.value })} />
          <Field label="Website" value={forms.contact.website} placeholder="example.com" inputMode="url" error={errorFor('website')} onChange={(event) => onChange('contact', { website: event.target.value })} />
        </div>
      )}

      {type === 'email' && (
        <div className="form-stack">
          <div className="form-grid">
            <Field label="To" type="email" value={forms.email.to} placeholder="name@example.com" error={errorFor('to')} onChange={(event) => onChange('email', { to: event.target.value })} />
            <Field label="Subject" value={forms.email.subject} placeholder="Optional" onChange={(event) => onChange('email', { subject: event.target.value })} />
          </div>
          <TextAreaField label="Message" rows={2} value={forms.email.body} placeholder="Optional" onChange={(body) => onChange('email', { body })} />
        </div>
      )}

      {type === 'phone' && (
        <Field
          label="Phone number"
          type="tel"
          value={forms.phone.number}
          placeholder="+1 555 010 9999"
          error={errorFor('number')}
          onChange={(event) => onChange('phone', { number: event.target.value })}
        />
      )}

      <div className="form-foot">
        <p className={`form-message${generalError ? ' is-error' : ''}`} role={generalError ? 'alert' : undefined}>
          {generalError ? (
            <>
              <CircleAlert size={13} strokeWidth={2} />
              {generalError}
            </>
          ) : (
            notice && (
              <>
                <Info size={13} strokeWidth={2} />
                {notice}
              </>
            )
          )}
        </p>
        {capacity && (
          <span className={`capacity${capacity.used > capacity.max ? ' is-over' : ''}`}>
            {format(capacity.used)} / {format(capacity.max)} bytes
          </span>
        )}
        <button type="submit" className="button button-primary generate-button">
          Generate
          <span className="keycap" aria-hidden="true">
            <CornerDownLeft size={12} strokeWidth={2} />
          </span>
        </button>
      </div>
    </form>
  )
}
