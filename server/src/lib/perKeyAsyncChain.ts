/**
 * Encadeia tarefas async por chave (ex.: `warehouseId`) para evitar refresh duplicado
 * e erros `invalid_grant` quando várias requisições recebem 401 em simultâneo.
 */
export class PerKeyAsyncChain {
  private readonly tails = new Map<string, Promise<unknown>>()

  run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const prev = this.tails.get(key) ?? Promise.resolve()
    const next = prev.then(() => task()) as Promise<T>
    this.tails.set(
      key,
      next.then(
        () => undefined,
        () => undefined,
      ),
    )
    return next
  }
}
