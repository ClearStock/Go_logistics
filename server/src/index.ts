import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { createSessionMiddleware } from './auth/session.js'
import { getFieldEncryptionKey } from './crypto/fieldEncryption.js'
import { registerApicbaseAuthRoutes } from './http/apicbaseAuthRoutes.js'
import { registerAuthUserRoutes } from './http/authRoutes.js'
import { registerImapEmailRoutes } from './http/imapEmailRoutes.js'
import { registerIntegrationRoutes } from './http/integrationRoutes.js'
import { registerVerificationRoutes } from './http/verificationRoutes.js'
import { PerKeyAsyncChain } from './lib/perKeyAsyncChain.js'
import { ApicbaseAuthService } from './services/ApicbaseAuthService.js'
import { ApicbaseClient } from './services/ApicbaseClient.js'
import { PrismaOrganizationApicbaseStore } from './storage/prismaOrganizationApicbaseStore.js'
import { defaultInvoiceDraftStorageRoot, startImapInvoiceWorker } from './workers/imapInvoiceWorker.js'

const PORT = Number(process.env.PORT ?? 8787)
const successRedirect =
  process.env.APICBASE_OAUTH_SUCCESS_REDIRECT ?? 'http://localhost:5173/?apicbase_oauth=ok'

const apicbaseConfig = {
  tokenUrl: process.env.APICBASE_TOKEN_URL ?? 'https://api.apicbase.com/oauth/token/',
  apiBaseUrl: process.env.APICBASE_API_BASE_URL ?? 'https://api.apicbase.com',
  serviceAccountValidationPath: process.env.APICBASE_VALIDATE_PATH ?? '/api/v2/accounts/users',
}

const key = getFieldEncryptionKey()
const store = new PrismaOrganizationApicbaseStore(key)

const refreshChain = new PerKeyAsyncChain()
const authService = new ApicbaseAuthService(apicbaseConfig, store, store)

export function createApicbaseClient(organizationId: string): ApicbaseClient {
  return new ApicbaseClient({
    config: apicbaseConfig,
    organizationId,
    tokenStore: store,
    authService,
    refreshChain,
  })
}

const app = express()
app.set('trust proxy', 1)
app.disable('x-powered-by')

app.use(createSessionMiddleware())

const corsOrigins = process.env.CORS_ORIGIN
app.use(
  cors({
    origin:
      corsOrigins === '*' || !corsOrigins
        ? ['http://localhost:5173', 'http://127.0.0.1:5173']
        : corsOrigins.split(',').map((s) => s.trim()),
    credentials: true,
  }),
)
app.use(express.json({ limit: '1mb' }))

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

registerAuthUserRoutes(app)

registerApicbaseAuthRoutes(app, {
  authService,
  successRedirectBase: successRedirect,
})

registerIntegrationRoutes(app, {
  store,
  authService,
  apicbaseConfig,
  refreshChain,
  createApicbaseClient,
})

registerImapEmailRoutes(app, { encryptionKey: key })

registerVerificationRoutes(app, {
  createApicbaseClient,
  authService,
  tokenStore: store,
  refreshChain,
  apicbaseConfig,
})

startImapInvoiceWorker({
  encryptionKey: key,
  storageRoot: defaultInvoiceDraftStorageRoot(),
  pollIntervalMs: Number(process.env.IMAP_WORKER_POLL_MS ?? 600_000),
  enabled: process.env.IMAP_INVOICE_WORKER_ENABLED !== 'false',
})

app.listen(PORT, () => {
  console.log(`API a escutar em http://localhost:${PORT}`)
  console.log(`Callback OAuth: http://localhost:${PORT}/api/auth/apicbase/callback`)
})
