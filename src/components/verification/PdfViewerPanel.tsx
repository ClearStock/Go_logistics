import { FileText, Minus, Plus } from 'lucide-react'
import { useState } from 'react'

const ZOOM_STEPS = [100, 125, 150] as const

type PdfViewerPanelProps = {
  fileName: string
  /** Texto extra sob a área do documento (ex.: estado IMAP / PDF). */
  hint?: string
}

export function PdfViewerPanel({ fileName, hint }: PdfViewerPanelProps) {
  const [zoomIndex, setZoomIndex] = useState(0)
  const zoom = ZOOM_STEPS[zoomIndex]
  const page = 1
  const totalPages = 1

  const zoomIn = () => setZoomIndex((i) => Math.min(i + 1, ZOOM_STEPS.length - 1))
  const zoomOut = () => setZoomIndex((i) => Math.max(i - 1, 0))

  return (
    <section className="flex min-h-[280px] flex-1 flex-col border-app-border bg-app-bg lg:min-h-0 lg:border-r">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-app-border bg-app-surface px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="h-4 w-4 shrink-0 text-app-primary" aria-hidden />
          <p className="truncate text-xs font-medium text-app-text sm:text-sm">{fileName}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={zoomOut}
            disabled={zoomIndex === 0}
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-app-border bg-app-table-base text-app-muted transition hover:border-app-border-strong hover:bg-app-surface-muted hover:text-app-text disabled:pointer-events-none disabled:opacity-40"
            aria-label="Diminuir zoom"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="min-w-[3.25rem] text-center text-xs tabular-nums text-app-muted">{zoom}%</span>
          <button
            type="button"
            onClick={zoomIn}
            disabled={zoomIndex === ZOOM_STEPS.length - 1}
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-app-border bg-app-table-base text-app-muted transition hover:border-app-border-strong hover:bg-app-surface-muted hover:text-app-text disabled:pointer-events-none disabled:opacity-40"
            aria-label="Aumentar zoom"
          >
            <Plus className="h-4 w-4" />
          </button>
          <span className="ml-2 hidden text-xs text-app-muted sm:inline">
            Página{' '}
            <span className="font-medium text-app-text">
              {page} / {totalPages}
            </span>
          </span>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 items-stretch justify-center overflow-auto p-4">
        <div
          className="flex w-full max-w-xl flex-col items-center justify-center rounded-2xl border-2 border-dashed border-app-border-strong bg-app-table-base text-app-muted transition-transform duration-150"
          style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
        >
          <FileText className="mb-3 h-12 w-12 opacity-40" aria-hidden />
          <p className="text-sm font-medium text-app-text">Área do PDF</p>
          <p className="mt-1 max-w-[16rem] text-center text-xs leading-relaxed">
            {hint ??
              'Sem ficheiro local: o conteúdo virá do email IMAP ou do fluxo de importação. A pré-visualização PDF será ligada na próxima iteração.'}
          </p>
        </div>
      </div>
    </section>
  )
}
