export type ApicbaseProductOption = {
  id: string
  nome: string
  skuApicbase: string
}

type GlobalBucket = {
  items?: Array<Record<string, unknown>>
}

/** Converte resposta de GET /api/v2/search/global/ em opções para o combobox. */
export function flattenGlobalSearchProducts(data: unknown): ApicbaseProductOption[] {
  if (!data || typeof data !== 'object') return []
  const root = data as Record<string, GlobalBucket>
  const out: ApicbaseProductOption[] = []
  const buckets: (keyof typeof root)[] = ['ingredients', 'stock_items', 'supplier_packages']

  for (const b of buckets) {
    const items = root[b]?.items
    if (!Array.isArray(items)) continue
    for (const it of items) {
      const pk = it.pk
      if (pk == null) continue
      const id = `${String(b)}:${String(pk)}`
      let nome = 'Sem nome'
      let sku = String(pk)
      if (b === 'ingredients') {
        nome = String(it.name ?? it.short_name ?? nome)
        sku = String(it.short_name ?? it.gtin_list ?? pk)
      } else if (b === 'stock_items') {
        nome = String(it.name ?? nome)
        sku = String(it.gtin_list ?? it.name ?? pk)
      } else if (b === 'supplier_packages') {
        nome = String(it.supplier_product_name ?? it.supplier_name ?? nome)
        sku = String(it.supplier_article_number ?? pk)
      }
      out.push({ id, nome, skuApicbase: sku.slice(0, 120) })
    }
  }
  return out.slice(0, 50)
}
