import { FileText, Link2, Mail, Phone, UserRound, Wifi, type LucideIcon } from 'lucide-react'
import { useId } from 'react'
import { QR_TYPES } from '../lib/payload'
import type { QrType } from '../types'

export const TYPE_ICONS: Record<QrType, LucideIcon> = {
  url: Link2,
  text: FileText,
  wifi: Wifi,
  contact: UserRound,
  email: Mail,
  phone: Phone,
}

export function TypePicker({ value, onChange }: { value: QrType; onChange: (type: QrType) => void }) {
  const name = useId()
  return (
    <div className="type-grid" role="radiogroup" aria-label="QR type">
      {QR_TYPES.map((type) => {
        const Icon = TYPE_ICONS[type.id]
        return (
          <label key={type.id} className="type-tile" title={type.description}>
            <input
              type="radio"
              className="tile-input"
              name={name}
              value={type.id}
              checked={value === type.id}
              aria-label={`${type.name}: ${type.description}`}
              onChange={() => onChange(type.id)}
            />
            <span className="type-card" aria-hidden="true">
              <Icon size={19} strokeWidth={1.8} />
              <span className="type-name">{type.name}</span>
            </span>
          </label>
        )
      })}
    </div>
  )
}
