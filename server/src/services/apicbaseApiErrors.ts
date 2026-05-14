/** Mensagem para o cliente (UI) a partir de erros HTTP da API Apicbase. */
export function apicbaseHttpUserMessage(status: number, bodySnippet: string): string {
  if (status === 403) {
    return 'Acesso negado (403): não tem permissões na biblioteca Apicbase para esta operação. Verifique o utilizador e a biblioteca ativa.'
  }
  if (status === 401) {
    return 'Não autorizado (401): o token pode ter expirado ou ser inválido. Para OAuth, o servidor tentará renovar; se persistir, volte a autorizar ou configure um token de serviço.'
  }
  const trimmed = bodySnippet.trim().slice(0, 200)
  return trimmed ? `Erro Apicbase (HTTP ${status}): ${trimmed}` : `Erro Apicbase (HTTP ${status}).`
}
