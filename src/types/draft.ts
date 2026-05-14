/** Indica se o item foi mapeado automaticamente ou requer revisão humana. */
export type EstadoMapeamentoItem = 'mapeado_automatico' | 'revisao_pendente'

/** Uma linha de produto no rascunho extraído da fatura. */
export interface ItensDoRascunho {
  id: string
  estadoMapeamento: EstadoMapeamentoItem
  skuCliente: string
  nomeProdutoFatura: string
  /** Identificador do produto na Apicbase quando mapeado. */
  produtoApicbaseId: string | null
  /** Nome apresentado do produto Apicbase selecionado. */
  produtoApicbaseNome: string | null
  quantidadeFatura: number
}

/** Estado agregado da interface de verificação (rascunho + cliente). */
export interface RascunhoVerificacao {
  nomeArquivoPdf: string
  estadoRascunho: string
  dataRececao: string
  nomeClienteFatura: string
  clienteMapeadoApicbase: string
  moradaEntrega: string
  itens: ItensDoRascunho[]
}

/** Produto mínimo para o combobox de pesquisa Apicbase (API em tempo real). */
export interface ApicbaseProdutoOpcao {
  id: string
  nome: string
  skuApicbase: string
}

export function createEmptyVerificationLine(): ItensDoRascunho {
  return {
    id: crypto.randomUUID(),
    estadoMapeamento: 'revisao_pendente',
    skuCliente: '',
    nomeProdutoFatura: '',
    produtoApicbaseId: null,
    produtoApicbaseNome: null,
    quantidadeFatura: 0,
  }
}

export function createEmptyVerificationDraft(): RascunhoVerificacao {
  return {
    nomeArquivoPdf: '(sem documento)',
    estadoRascunho: 'Aguardar dados',
    dataRececao: new Date().toISOString(),
    nomeClienteFatura: '',
    clienteMapeadoApicbase: '',
    moradaEntrega: '',
    itens: [],
  }
}
