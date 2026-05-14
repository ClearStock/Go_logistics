import type { MessageStructureObject } from 'imapflow'

/**
 * Lista partes do BODYSTRUCTURE que correspondem a anexos PDF (tipo ou extensão .pdf).
 */
export function collectPdfAttachmentParts(
  struct: MessageStructureObject | undefined,
): Array<{ partId: string; filename: string }> {
  const out: Array<{ partId: string; filename: string }> = []
  if (!struct) return out

  const disp = struct.dispositionParameters?.filename
  const par = struct.parameters?.name
  const raw = typeof disp === 'string' ? disp : typeof par === 'string' ? par : ''
  const name = stripMimeEncodedFilename(raw)
  const lower = name.toLowerCase()
  const type = (struct.type || '').toLowerCase()
  const byExt = lower.endsWith('.pdf')
  const byType = type === 'application/pdf' || type.endsWith('/pdf')

  if (struct.part && (byExt || byType)) {
    out.push({ partId: struct.part, filename: name || 'attachment.pdf' })
  }

  if (struct.childNodes?.length) {
    for (const ch of struct.childNodes) {
      out.push(...collectPdfAttachmentParts(ch))
    }
  }
  return out
}

function stripMimeEncodedFilename(s: string): string {
  if (!s) return s
  return s.replace(/=\?[^?]+\?[BbQq]\?[^?]*\?=/g, '').trim() || s
}
