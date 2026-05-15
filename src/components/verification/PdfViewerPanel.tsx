import { FileText, Loader2, Minus, Plus } from 'lucide-react'
import { useId, useState } from 'react'

const ZOOM_STEPS = [100, 125, 150] as const

const pickerSelectClass =
  'min-w-0 flex-1 rounded-lg border border-app-border bg-app-table-base px-2 py-1.5 text-xs text-app-text outline-none transition focus:border-app-primary focus:ring-2 focus:ring-app-primary/25'

type PdfViewerPanelProps = {
  fileName: string
  hint?: string
  pdfObjectUrl?: string | null
  pdfLoading?: boolean
  pdfError?: string | null
  /** Quando há mais do que um nome, mostra selector para alternar o anexo. */
  pdfAttachmentNames?: readonly string[]
  selectedPdfIndex?: number
  onSelectPdfIndex?: (index: number) => void
}

export function PdfViewerPanel({
  fileName,
  hint,
  pdfObjectUrl,
  pdfLoading,
  pdfError,
  pdfAttachmentNames,
  selectedPdfIndex = 0,
  onSelectPdfIndex,
}: PdfViewerPanelProps) {
  const pickerId = useId()
  const [zoomIndex, setZoomIndex] = useState(0)
  const zoom = ZOOM_STEPS[zoomIndex]
  const page = 1
  const totalPages = 1

  const zoomIn = () => setZoomIndex((i) => Math.min(i + 1, ZOOM_STEPS.length - 1))
  const zoomOut = () => setZoomIndex((i) => Math.max(i - 1, 0))

  const showPdf = Boolean(pdfObjectUrl && !pdfLoading && !pdfError)

  const names = pdfAttachmentNames ?? []
  const showPdfPicker = names.length > 1 && typeof onSelectPdfIndex === 'function'
  const safePdfIndex = Math.min(Math.max(0, selectedPdfIndex), Math.max(0, names.length - 1))

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
            disabled={zoomIndex === 0 || !showPdf}
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-app-border bg-app-table-base text-app-muted transition hover:border-app-border-strong hover:bg-app-surface-muted hover:text-app-text disabled:pointer-events-none disabled:opacity-40"
            aria-label="Diminuir zoom"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="min-w-[3.25rem] text-center text-xs tabular-nums text-app-muted">{zoom}%</span>
          <button
            type="button"
            onClick={zoomIn}
            disabled={zoomIndex === ZOOM_STEPS.length - 1 || !showPdf}
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

      {showPdfPicker && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-app-border bg-app-surface-muted px-3 py-2">
          <label htmlFor={pickerId} className="shrink-0 text-xs font-medium text-app-muted">
            Anexo PDF
          </label>
          <select
            id={pickerId}
            className={pickerSelectClass}
            value={String(safePdfIndex)}
            onChange={(e) => onSelectPdfIndex?.(Number(e.target.value))}
          >
            {names.map((name, i) => (
              <option key={`${i}-${name}`} value={String(i)}>
                {i + 1}. {name || `anexo-${i + 1}.pdf`}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-app-table-base">
        {pdfLoading && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-app-muted">
            <Loader2 className="h-10 w-10 animate-spin" aria-hidden />
            <p className="text-sm">A carregar PDF…</p>
          </div>
        )}

        {!pdfLoading && pdfError && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
            <p className="text-sm font-medium text-app-danger">Não foi possível mostrar o PDF</p>
            <p className="max-w-sm text-xs text-app-muted">{pdfError}</p>
          </div>
        )}

        {!pdfLoading && !pdfError && !pdfObjectUrl && (
          <div className="flex flex-1 flex-col items-center justify-center overflow-auto p-4">
            <div
              className="flex w-full max-w-xl flex-col items-center justify-center rounded-2xl border-2 border-dashed border-app-border-strong bg-app-table-base p-6 text-app-muted transition-transform duration-150"
              style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
            >
              <FileText className="mb-3 h-12 w-12 opacity-40" aria-hidden />
              <p className="text-sm font-medium text-app-text">Sem PDF</p>
              <p className="mt-1 max-w-[16rem] text-center text-xs leading-relaxed">
                {hint ?? 'Seleccione na lista um email com anexo PDF para pré-visualizar aqui.'}
              </p>
            </div>
          </div>
        )}

        {pdfObjectUrl && !pdfLoading && !pdfError && (
          <div className="min-h-0 flex-1 overflow-auto p-2">
            <div
              className="mx-auto origin-top"
              style={{
                transform: `scale(${zoom / 100})`,
                width: `${100 / (zoom / 100)}%`,
                maxWidth: zoom <= 100 ? '100%' : undefined,
              }}
            >
              <iframe
                title="Pré-visualização PDF"
                src={pdfObjectUrl}
                className="h-[min(85vh,900px)] w-full min-h-[420px] rounded-lg border border-app-border bg-white shadow-sm"
              />
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
