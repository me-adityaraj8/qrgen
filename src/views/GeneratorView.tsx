import { useEffect, useRef } from 'react'
import { ContentForm } from '../components/ContentForm'
import { CustomizeCard } from '../components/CustomizeCard'
import { PreviewPanel, type PreviewPhase } from '../components/PreviewPanel'
import { TypePicker } from '../components/TypePicker'
import { StepCard } from '../components/ui'
import type { Generator } from '../hooks/useGenerator'
import { isDefaultSettings } from '../lib/settings'
import type { QrSettings } from '../types'

interface GeneratorViewProps {
  generator: Generator
  settings: QrSettings
  ready: boolean
  logo: string | null
  onSettingsChange: (patch: Partial<QrSettings>) => void
  onReset: () => void
  onLogoUpload: (file: File) => void
  onLogoRemove: () => void
}

const SUBTITLES = {
  url: 'Add your URL or link below',
  text: 'Type the text to share',
  wifi: 'Guests scan to join your network',
  contact: 'Saved as a vCard contact',
  email: 'Opens a new email when scanned',
  phone: 'Starts a call when scanned',
} as const

export function GeneratorView({ generator: g, settings, ready, logo, onSettingsChange, onReset, onLogoUpload, onLogoRemove }: GeneratorViewProps) {
  const urlInput = useRef<HTMLInputElement>(null)

  // Start in the URL field so a new address can be typed right away.
  useEffect(() => {
    const field = urlInput.current
    if (!g.initialized || !field) return
    field.focus()
    field.setSelectionRange(field.value.length, field.value.length)
  }, [g.initialized])

  let phase: PreviewPhase
  if (!g.initialized || !ready) phase = { kind: 'loading' }
  else if (!g.result || !g.committed) phase = { kind: 'empty' }
  else if (!g.result.ok) phase = { kind: 'error', message: g.result.error }
  else phase = { kind: 'ready', qr: g.result.qr, content: g.committed, stale: g.isStale }

  return (
    <div className="generator">
      <div className="controls">
        <StepCard step={1} title="Choose QR Type" subtitle="Select what you want to encode">
          <TypePicker value={g.type} onChange={g.selectType} />
        </StepCard>

        <StepCard step={2} title="Enter Content" subtitle={SUBTITLES[g.type]}>
          <ContentForm
            type={g.type}
            forms={g.forms}
            onChange={g.updateForm}
            onGenerate={g.generate}
            onUseCurrentTab={g.fillCurrentTab}
            isCurrentTab={g.isCurrentTab}
            error={g.fieldError}
            notice={g.notice}
            capacity={g.capacity}
            urlInputRef={urlInput}
          />
        </StepCard>

        <CustomizeCard
          settings={settings}
          contrast={g.contrast}
          isDefault={isDefaultSettings(settings) && logo === null}
          logo={logo}
          onChange={onSettingsChange}
          onReset={onReset}
          onLogoUpload={onLogoUpload}
          onLogoRemove={onLogoRemove}
        />
      </div>

      <PreviewPanel
        phase={phase}
        design={g.design}
        size={settings.size}
        busy={g.busy}
        canExport={g.canExport}
        blocked={g.contrastBlocks}
        onDownload={(format) => void g.download(format)}
        onCopyImage={() => void g.copyCodeImage()}
        onCopyContent={() => void g.copyContent()}
      />
    </div>
  )
}
