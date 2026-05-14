import { Check, ChevronsUpDown, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ApicbaseProdutoOpcao } from '../../types/draft'

type ProductSearchComboboxProps = {
  /** Lista local (só usada se `fetchOptions` não for passado). */
  produtos?: ApicbaseProdutoOpcao[]
  /** Pesquisa em tempo real na biblioteca Apicbase (via backend). */
  fetchOptions?: (q: string) => Promise<ApicbaseProdutoOpcao[]>
  selectedId: string | null
  selectedLabel: string | null
  placeholder?: string
  onSelect: (produto: ApicbaseProdutoOpcao) => void
}

const REMOTE_DEBOUNCE_MS = 350

export function ProductSearchCombobox({
  produtos = [],
  fetchOptions,
  selectedId,
  selectedLabel,
  placeholder = 'Pesquisar produto Apicbase…',
  onSelect,
}: ProductSearchComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [remoteList, setRemoteList] = useState<ApicbaseProdutoOpcao[]>([])
  const [remoteLoading, setRemoteLoading] = useState(false)
  const [remoteError, setRemoteError] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const displayValue = open ? query : selectedLabel ?? ''

  const filteredLocal = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return produtos
    return produtos.filter(
      (p) =>
        p.nome.toLowerCase().includes(q) ||
        p.skuApicbase.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q),
    )
  }, [produtos, query])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  useEffect(() => {
    if (!open || !fetchOptions) return

    const q = query.trim()
    if (q.length < 2) {
      setRemoteList([])
      setRemoteError(null)
      setRemoteLoading(false)
      return
    }

    let cancelled = false
    setRemoteLoading(true)
    setRemoteError(null)

    const t = setTimeout(() => {
      void (async () => {
        try {
          const rows = await fetchOptions(q)
          if (!cancelled) {
            setRemoteList(rows)
            setRemoteError(null)
          }
        } catch (e) {
          if (!cancelled) {
            setRemoteList([])
            setRemoteError(e instanceof Error ? e.message : 'Erro na pesquisa')
          }
        } finally {
          if (!cancelled) setRemoteLoading(false)
        }
      })()
    }, REMOTE_DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [open, fetchOptions, query])

  const listItems = fetchOptions
    ? query.trim().length < 2
      ? ([] as ApicbaseProdutoOpcao[])
      : remoteList
    : filteredLocal

  const showMinCharsHint = Boolean(fetchOptions && open && query.trim().length < 2)
  const showLoadingRow = Boolean(fetchOptions && open && query.trim().length >= 2 && remoteLoading && listItems.length === 0 && !remoteError)
  const showEmptyAfterSearch = Boolean(
    fetchOptions && open && query.trim().length >= 2 && !remoteLoading && !remoteError && listItems.length === 0,
  )

  return (
    <div ref={rootRef} className="relative w-full min-w-[12rem]">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-app-muted" />
        <input
          type="text"
          value={displayValue}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value)
            if (!open) setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          className="w-full rounded-xl border border-app-border bg-app-table-base py-2 pl-9 pr-9 text-sm text-app-text outline-none transition focus:border-app-primary focus:ring-2 focus:ring-app-primary/25"
          aria-expanded={open}
          aria-haspopup="listbox"
          autoComplete="off"
        />
        <button
          type="button"
          className="absolute right-1 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-app-muted transition hover:bg-app-surface-muted hover:text-app-text"
          aria-label="Abrir lista de produtos"
          onClick={() => {
            setOpen((v) => !v)
            if (!open) setQuery('')
          }}
        >
          <ChevronsUpDown className="h-4 w-4" />
        </button>
      </div>

      {open && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 max-h-52 w-full overflow-auto rounded-xl border border-app-border bg-app-table-base py-1 text-sm"
        >
          {showMinCharsHint && (
            <li className="px-3 py-2 text-app-muted">Escreva pelo menos 2 caracteres para pesquisar na Apicbase.</li>
          )}
          {showLoadingRow && <li className="px-3 py-2 text-app-muted">A pesquisar…</li>}
          {fetchOptions && open && query.trim().length >= 2 && remoteError && (
            <li className="px-3 py-2 text-app-danger">{remoteError}</li>
          )}
          {listItems.map((p) => {
            const active = p.id === selectedId
            return (
              <li key={p.id} role="option" aria-selected={active}>
                <button
                  type="button"
                  className="flex w-full items-start gap-2 px-3 py-2 text-left transition hover:bg-app-surface-muted"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onSelect(p)
                    setQuery('')
                    setOpen(false)
                  }}
                >
                  {active && <Check className="mt-0.5 h-4 w-4 shrink-0 text-app-success" />}
                  <span className={active ? 'pl-0' : 'pl-6'}>
                    <span className="block font-medium text-app-text">{p.nome}</span>
                    <span className="text-xs text-app-muted">{p.skuApicbase}</span>
                  </span>
                </button>
              </li>
            )
          })}
          {showEmptyAfterSearch && <li className="px-3 py-2 text-app-muted">Sem resultados.</li>}
          {!fetchOptions && listItems.length === 0 && (
            <li className="px-3 py-2 text-app-muted">Sem resultados.</li>
          )}
        </ul>
      )}
    </div>
  )
}
