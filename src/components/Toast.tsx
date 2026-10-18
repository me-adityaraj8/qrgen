import { Check, CircleAlert, Info, X } from 'lucide-react'

export type ToastMessage = { id: number; tone: 'success' | 'error' | 'neutral'; text: string } | null

/** Transient feedback for downloads and copies. Errors are announced assertively. */
export function Toast({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  return (
    <div className="toast-region" role={toast?.tone === 'error' ? 'alert' : 'status'} aria-live={toast?.tone === 'error' ? 'assertive' : 'polite'}>
      {toast && (
        <div key={toast.id} className={`toast is-${toast.tone}`}>
          {toast.tone === 'success' && <Check size={15} strokeWidth={2.2} />}
          {toast.tone === 'error' && <CircleAlert size={15} strokeWidth={2} />}
          {toast.tone === 'neutral' && <Info size={15} strokeWidth={2} />}
          <span className="toast-text">{toast.text}</span>
          <button type="button" className="toast-close" aria-label="Dismiss" onClick={onDismiss}>
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      )}
    </div>
  )
}
