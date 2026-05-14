import connectPgSimple from 'connect-pg-simple'
import session from 'express-session'
import pg from 'pg'

const PgSession = connectPgSimple(session)

function envSessionSecret(): string | undefined {
  const v = process.env.SESSION_SECRET
  if (v == null) return undefined
  const t = v.trim()
  return t === '' ? undefined : t
}

export function createSessionMiddleware(): ReturnType<typeof session> {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
  })

  const store = new PgSession({
    pool,
    tableName: 'session',
    createTableIfMissing: false,
  })

  const secret =
    envSessionSecret() ??
    (process.env.NODE_ENV === 'production' ? undefined : 'dev-session-secret-change-in-prod-32c!')
  if (!secret || secret.length < 32) {
    throw new Error('Defina SESSION_SECRET com pelo menos 32 caracteres.')
  }

  const maxAgeMs = Number(process.env.SESSION_MAX_AGE_MS ?? 1000 * 60 * 60 * 24 * 7)

  return session({
    store,
    name: 'sid',
    secret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: maxAgeMs,
    },
  })
}
