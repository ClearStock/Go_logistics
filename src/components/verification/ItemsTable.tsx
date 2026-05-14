import { AlertTriangle, CheckCircle2, Trash2 } from 'lucide-react'
import type { ApicbaseProdutoOpcao, ItensDoRascunho } from '../../types/draft'
import { ProductSearchCombobox } from './ProductSearchCombobox'

type ItemsTableProps = {
  itens: ItensDoRascunho[]
  fetchApicbaseOptions: (q: string) => Promise<ApicbaseProdutoOpcao[]>
  onChangeItem: (id: string, patch: Partial<ItensDoRascunho>) => void
  onRemoveItem: (id: string) => void
}

export function ItemsTable({ itens, fetchApicbaseOptions, onChangeItem, onRemoveItem }: ItemsTableProps) {
  const inputClass =
    'w-full min-w-0 rounded-xl border border-app-border bg-app-table-base px-2 py-1.5 text-sm text-app-text outline-none transition focus:border-app-primary focus:ring-2 focus:ring-app-primary/25'

  return (
    <div className="overflow-x-auto rounded-2xl border border-app-border bg-app-surface">
      <table className="w-full min-w-[920px] border-collapse text-left text-sm font-sans">
        <thead>
          <tr className="border-b border-app-border bg-app-surface text-xs font-semibold uppercase tracking-wide text-app-muted">
            <th className="w-12 px-3 py-3 text-center">Estado</th>
            <th className="min-w-[7rem] px-3 py-3">SKU Cliente</th>
            <th className="min-w-[11rem] px-3 py-3">Nome Produto (Fatura)</th>
            <th className="min-w-[14rem] px-3 py-3">Produto Mapeado (Apicbase)</th>
            <th className="w-28 px-3 py-3">Qtd. (Fatura)</th>
            <th className="w-24 px-3 py-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {itens.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-3 py-8 text-center text-sm text-app-muted">
                Nenhuma linha. Use «Adicionar linha» para começar o mapeamento.
              </td>
            </tr>
          ) : null}
          {itens.map((item, rowIndex) => {
            const ok =
              item.estadoMapeamento === 'mapeado_automatico' &&
              item.produtoApicbaseId != null
            const needsAttention =
              item.estadoMapeamento === 'revisao_pendente' || item.produtoApicbaseId == null

            const stripe = rowIndex % 2 === 0 ? 'bg-app-table-base' : 'bg-app-table-alt'

            return (
              <tr
                key={item.id}
                className={`border-b border-app-border/80 last:border-0 transition-colors hover:brightness-[0.99] ${stripe}`}
              >
                <td className="px-3 py-2 align-middle">
                  <div className="flex justify-center">
                    {ok ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-app-success px-2.5 py-1 text-xs font-semibold text-app-success-on"
                        title="SKU mapeado"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        OK
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 rounded-full border border-app-border bg-app-warning-muted px-2.5 py-1 text-xs font-semibold text-app-text"
                        title={needsAttention ? 'Requer revisão' : 'Estado'}
                      >
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        Rev.
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 align-middle">
                  <input
                    className={`${inputClass} tabular-nums`}
                    value={item.skuCliente}
                    onChange={(e) => onChangeItem(item.id, { skuCliente: e.target.value })}
                    aria-label="SKU Cliente"
                  />
                </td>
                <td className="px-3 py-2 align-middle">
                  <input
                    className={inputClass}
                    value={item.nomeProdutoFatura}
                    onChange={(e) => onChangeItem(item.id, { nomeProdutoFatura: e.target.value })}
                    aria-label="Nome produto na fatura"
                  />
                </td>
                <td className="px-3 py-2 align-middle">
                  <ProductSearchCombobox
                    fetchOptions={fetchApicbaseOptions}
                    selectedId={item.produtoApicbaseId}
                    selectedLabel={item.produtoApicbaseNome}
                    onSelect={(p) =>
                      onChangeItem(item.id, {
                        produtoApicbaseId: p.id,
                        produtoApicbaseNome: `${p.nome} (${p.skuApicbase})`,
                        estadoMapeamento: 'mapeado_automatico',
                      })
                    }
                  />
                </td>
                <td className="px-3 py-2 align-middle">
                  <input
                    type="number"
                    min={0}
                    className={`${inputClass} tabular-nums`}
                    value={item.quantidadeFatura}
                    onChange={(e) =>
                      onChangeItem(item.id, {
                        quantidadeFatura: Number(e.target.value) || 0,
                      })
                    }
                    aria-label="Quantidade na fatura"
                  />
                </td>
                <td className="px-3 py-2 align-middle text-right">
                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.id)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-app-muted transition hover:border-app-danger/30 hover:bg-app-danger-muted hover:text-app-danger"
                    aria-label="Remover linha"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
