import { Mail, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { confirmVerificationDraft, fetchImapMessages, searchApicbaseProducts } from '../../api/verificationApi'
import type { InboxMessageDto } from '../../api/verificationApi'
import {
  createEmptyVerificationDraft,
  createEmptyVerificationLine,
  type ItensDoRascunho,
  type RascunhoVerificacao,
} from '../../types/draft'
import { ActionFooter } from './ActionFooter'
import { ItemsTable } from './ItemsTable'
import { PdfViewerPanel } from './PdfViewerPanel'

const fieldClass =
  'w-full rounded-xl border border-app-border bg-app-table-base px-3 py-2 text-sm text-app-text outline-none transition focus:border-app-primary focus:ring-2 focus:ring-app-primary/25'

function cloneRascunho(r: RascunhoVerificacao): RascunhoVerificacao {
  return { ...r, itens: r.itens.map((i) => ({ ...i })) }
}

export function VerificationWorkspace() {
  const [draft, setDraft] = useState<RascunhoVerificacao>(() => cloneRascunho(createEmptyVerificationDraft()))
  const [imapMessages, setImapMessages] = useState<InboxMessageDto[]>([])
  const [imapHint, setImapHint] = useState<string | null>(null)
  const [imapConfigured, setImapConfigured] = useState(false)
  const [imapLoading, setImapLoading] = useState(true)
  const [imapError, setImapError] = useState<string | null>(null)
  const [selectedUid, setSelectedUid] = useState<number | null>(null)

  const loadImap = useCallback(async () => {
    setImapLoading(true)
    setImapError(null)
    try {
      const res = await fetchImapMessages(40)
      setImapConfigured(res.configured)
      setImapMessages(res.messages)
      setImapHint(res.hint ?? null)
    } catch (e) {
      setImapError(e instanceof Error ? e.message : 'Erro ao carregar emails')
      setImapMessages([])
    } finally {
      setImapLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadImap()
  }, [loadImap])

  const dataRececaoFormatada = useMemo(
    () =>
      new Intl.DateTimeFormat('pt-PT', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(draft.dataRececao)),
    [draft.dataRececao],
  )

  const pdfHint = useMemo(() => {
    if (!selectedUid) return undefined
    const m = imapMessages.find((x) => x.uid === selectedUid)
    if (!m) return undefined
    return m.hasPdfAttachment
      ? `Email UID ${m.uid}: anexo PDF detetado (extração no servidor em desenvolvimento).`
      : `Email UID ${m.uid}: sem anexo PDF detetado na estrutura da mensagem.`
  }, [imapMessages, selectedUid])

  const onChangeField = (
    key: keyof Pick<RascunhoVerificacao, 'nomeClienteFatura' | 'clienteMapeadoApicbase' | 'moradaEntrega'>,
    value: string,
  ) => {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  const onChangeItem = (id: string, patch: Partial<ItensDoRascunho>) => {
    setDraft((d) => ({
      ...d,
      itens: d.itens.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    }))
  }

  const onRemoveItem = (id: string) => {
    setDraft((d) => ({ ...d, itens: d.itens.filter((it) => it.id !== id) }))
  }

  const fetchApicbaseOptions = useCallback((q: string) => searchApicbaseProducts(q), [])

  const selectMessage = (m: InboxMessageDto) => {
    setSelectedUid(m.uid)
    const label = m.hasPdfAttachment ? `${m.subject} · PDF` : m.subject
    setDraft((d) => ({
      ...d,
      nomeArquivoPdf: label.slice(0, 200) || `(email UID ${m.uid})`,
      dataRececao: m.date || d.dataRececao,
      estadoRascunho: 'Email selecionado',
    }))
    console.log('[Verify/UI] Email selecionado', { uid: m.uid, subject: m.subject, hasPdf: m.hasPdfAttachment })
  }

  const toast = (msg: string) => {
    window.alert(msg)
  }

  const onConfirm = async () => {
    const result = await confirmVerificationDraft(draft)
    if (!result.ok) {
      window.alert(result.error)
      return
    }
    toast(result.message ?? 'Confirmado.')
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="flex max-h-[40vh] shrink-0 flex-col border-app-border bg-app-surface lg:max-h-none lg:w-72 lg:border-r">
          <div className="flex items-center justify-between gap-2 border-b border-app-border px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <Mail className="h-4 w-4 shrink-0 text-app-primary" aria-hidden />
              <span className="truncate text-xs font-semibold text-app-text">Caixa IMAP</span>
            </div>
            <button
              type="button"
              onClick={() => void loadImap()}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-app-border text-app-muted transition hover:bg-app-table-base hover:text-app-text"
              aria-label="Atualizar lista de emails"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${imapLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 text-xs">
            {imapLoading && <p className="px-1 py-2 text-app-muted">A carregar…</p>}
            {imapError && <p className="px-1 py-2 text-app-danger">{imapError}</p>}
            {!imapLoading && imapHint && !imapConfigured && (
              <p className="px-1 py-2 leading-relaxed text-app-muted">{imapHint}</p>
            )}
            {!imapLoading && imapConfigured && imapMessages.length === 0 && (
              <p className="px-1 py-2 text-app-muted">Caixa vazia nesta janela.</p>
            )}
            <ul className="space-y-1">
              {imapMessages.map((m) => {
                const active = m.uid === selectedUid
                return (
                  <li key={m.uid}>
                    <button
                      type="button"
                      onClick={() => selectMessage(m)}
                      className={`w-full rounded-lg border px-2 py-2 text-left transition ${
                        active
                          ? 'border-app-primary bg-app-primary/10 text-app-text'
                          : 'border-transparent bg-app-table-base hover:border-app-border'
                      }`}
                    >
                      <span className="line-clamp-2 font-medium text-app-text">{m.subject || '(sem assunto)'}</span>
                      <span className="mt-0.5 line-clamp-1 text-app-muted">{m.from}</span>
                      {m.hasPdfAttachment && (
                        <span className="mt-1 inline-block rounded bg-app-success-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-app-text">
                          PDF
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </aside>

        <PdfViewerPanel fileName={draft.nomeArquivoPdf} hint={pdfHint} />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-app-bg">
          <header className="shrink-0 border-b border-app-border bg-app-surface px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <h1 className="text-lg font-semibold tracking-tight text-app-text sm:text-xl">
                  Interface de Verificação
                </h1>
                <p className="truncate text-xs font-medium tabular-nums text-app-muted sm:text-sm">{draft.nomeArquivoPdf}</p>
              </div>
              <div className="flex flex-col items-end gap-1 text-right">
                <span className="inline-flex items-center rounded-full border border-app-border bg-app-warning-muted px-3 py-1 text-xs font-semibold text-app-text">
                  {draft.estadoRascunho}
                </span>
                <p className="text-xs text-app-muted">
                  Receção: <span className="font-medium text-app-text">{dataRececaoFormatada}</span>
                </p>
              </div>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <div className="mx-auto max-w-5xl space-y-6 pb-2">
              <section className="rounded-2xl border border-app-border bg-app-surface p-5">
                <h2 className="mb-3 text-sm font-semibold text-app-text">Dados do Cliente e Envio</h2>
                <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
                  <label className="block space-y-1.5 lg:col-span-2">
                    <span className="text-xs font-medium text-app-muted">Nome do Cliente (Fatura)</span>
                    <input
                      className={fieldClass}
                      value={draft.nomeClienteFatura}
                      onChange={(e) => onChangeField('nomeClienteFatura', e.target.value)}
                    />
                  </label>
                  <label className="block space-y-1.5 lg:col-span-2">
                    <span className="text-xs font-medium text-app-muted">Cliente Mapeado (Apicbase)</span>
                    <input
                      className={fieldClass}
                      value={draft.clienteMapeadoApicbase}
                      onChange={(e) => onChangeField('clienteMapeadoApicbase', e.target.value)}
                    />
                  </label>
                  <label className="block space-y-1.5 lg:col-span-2">
                    <span className="text-xs font-medium text-app-muted">Morada de Entrega</span>
                    <textarea
                      className={`${fieldClass} min-h-[4.5rem] resize-y`}
                      value={draft.moradaEntrega}
                      onChange={(e) => onChangeField('moradaEntrega', e.target.value)}
                    />
                  </label>
                </div>
              </section>

              <section>
                <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                  <h2 className="text-sm font-semibold text-app-text">Itens do Rascunho</h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs text-app-muted">{draft.itens.length} linhas · dados da Apicbase em tempo real</p>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          itens: [...d.itens, createEmptyVerificationLine()],
                        }))
                      }
                      className="rounded-lg border border-app-border bg-app-table-base px-3 py-1.5 text-xs font-semibold text-app-text transition hover:border-app-primary hover:bg-app-surface-muted"
                    >
                      Adicionar linha
                    </button>
                  </div>
                </div>
                <ItemsTable
                  itens={draft.itens}
                  fetchApicbaseOptions={fetchApicbaseOptions}
                  onChangeItem={onChangeItem}
                  onRemoveItem={onRemoveItem}
                />
              </section>
            </div>
          </div>

          <ActionFooter
            onReject={() => toast('Rascunho rejeitado (prototipagem — sem persistência).')}
            onSave={() => toast('Rascunho apenas em memória neste protótipo.')}
            onConfirm={() => void onConfirm()}
          />
        </div>
      </div>
    </div>
  )
}
