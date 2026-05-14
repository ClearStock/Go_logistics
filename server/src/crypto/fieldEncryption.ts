import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const ALGO = 'aes-256-gcm' as const
const IV_LEN = 12
const TAG_LEN = 16

function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret, 'utf8').digest()
}

function envSecret(name: 'FIELD_ENCRYPTION_KEY' | 'MASTER_ENCRYPTION_KEY'): string | undefined {
  const v = process.env[name]
  if (v == null) return undefined
  const t = v.trim()
  return t === '' ? undefined : t
}

export function getFieldEncryptionKey(): Buffer {
  const raw =
    envSecret('FIELD_ENCRYPTION_KEY') ??
    envSecret('MASTER_ENCRYPTION_KEY') ??
    (process.env.NODE_ENV === 'production' ? undefined : 'dev-insecure-key-change-in-env')
  if (!raw) {
    throw new Error(
      'Defina FIELD_ENCRYPTION_KEY (ou MASTER_ENCRYPTION_KEY) no ambiente do servidor para encriptar segredos em repouso.',
    )
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex')
  return deriveKey(raw)
}

/** Devolve string base64url (iv + tag + ciphertext). */
export function encryptUtf8(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGO, key, iv, { authTagLength: TAG_LEN })
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ciphertext]).toString('base64url')
}

export function decryptUtf8(payload: string, key: Buffer): string {
  const buf = Buffer.from(payload, 'base64url')
  if (buf.length < IV_LEN + TAG_LEN + 1) throw new Error('Payload encriptado inválido')
  const iv = buf.subarray(0, IV_LEN)
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN)
  const ciphertext = buf.subarray(IV_LEN + TAG_LEN)
  const decipher = createDecipheriv(ALGO, key, iv, { authTagLength: TAG_LEN })
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
