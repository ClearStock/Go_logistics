type ActionFooterProps = {
  onReject: () => void
  onSave: () => void
  onConfirm: () => void
}

export function ActionFooter({ onReject, onSave, onConfirm }: ActionFooterProps) {
  return (
    <footer className="shrink-0 border-t border-app-border bg-app-surface/90 px-4 py-3 backdrop-blur-sm supports-[backdrop-filter]:bg-app-surface/75">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onReject}
            className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-app-danger/35 bg-app-table-base px-4 text-sm font-semibold text-app-danger transition hover:bg-app-danger-muted"
          >
            Rejeitar Rascunho
          </button>
          <button
            type="button"
            onClick={onSave}
            className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-app-border bg-app-table-base px-4 text-sm font-semibold text-app-text transition hover:border-app-border-strong hover:bg-app-surface-muted"
          >
            Guardar Rascunho
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex min-h-10 items-center justify-center rounded-2xl bg-app-primary px-4 text-sm font-semibold text-white transition hover:bg-app-primary-hover"
          >
            Confirmar e Enviar para Apicbase
          </button>
        </div>
      </div>
    </footer>
  )
}
