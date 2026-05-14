import { Role } from '@prisma/client'
import type { Express, Request, Response } from 'express'
import rateLimit from 'express-rate-limit'
import { hashPassword, verifyPassword } from '../auth/password.js'
import { regenerateSession, saveSession } from '../auth/sessionUtils.js'
import { requireAuth } from '../middleware/auth.js'
import { prisma } from '../prisma.js'

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas tentativas de login. Tente mais tarde.' },
})

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados registos a partir deste IP. Tente mais tarde.' },
})

const emailOk = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

export function registerAuthUserRoutes(app: Express): void {
  app.post('/api/auth/register', registerLimiter, async (req, res) => {
    const body = req.body as {
      organizationName?: unknown
      adminName?: unknown
      email?: unknown
      password?: unknown
    }

    const organizationName =
      typeof body.organizationName === 'string' ? body.organizationName.trim() : ''
    const adminName = typeof body.adminName === 'string' ? body.adminName.trim() : ''
    const emailRaw = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!organizationName || !adminName || !emailRaw || !password) {
      res.status(400).json({ error: 'Todos os campos são obrigatórios.' })
      return
    }
    if (!emailOk(emailRaw)) {
      res.status(400).json({ error: 'Email inválido.' })
      return
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'A palavra-passe deve ter pelo menos 8 caracteres.' })
      return
    }

    try {
      const passwordHash = await hashPassword(password)
      const org = await prisma.organization.create({
        data: { name: organizationName },
      })
      await prisma.user.create({
        data: {
          email: emailRaw,
          passwordHash,
          name: adminName,
          role: Role.ADMIN,
          organizationId: org.id,
        },
      })
      res.status(201).json({ ok: true, organizationId: org.id })
    } catch (e: unknown) {
      if (typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === 'P2002') {
        res.status(409).json({ error: 'Já existe uma conta com este email.' })
        return
      }
      res.status(500).json({ error: 'Não foi possível concluir o registo.' })
    }
  })

  app.post('/api/auth/login', loginLimiter, async (req, res) => {
    const body = req.body as { email?: unknown; password?: unknown }
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!email || !password) {
      res.status(400).json({ error: 'Email e palavra-passe são obrigatórios.' })
      return
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { organization: { select: { id: true, name: true } } },
    })
    const invalid = { error: 'Credenciais inválidas.' }

    if (!user) {
      res.status(401).json(invalid)
      return
    }

    const ok = await verifyPassword(password, user.passwordHash)
    if (!ok) {
      res.status(401).json(invalid)
      return
    }

    try {
      await regenerateSession(req)
      req.session.userId = user.id
      await saveSession(req)
      res.json({
        ok: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: user.organizationId,
        },
        organization: user.organization,
      })
    } catch {
      res.status(500).json({ error: 'Não foi possível iniciar sessão.' })
    }
  })

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    req.session.destroy((err) => {
      res.clearCookie('sid', { path: '/' })
      if (err) {
        res.status(500).json({ error: 'Falha ao terminar sessão.' })
        return
      }
      res.json({ ok: true })
    })
  })

  app.get('/api/auth/me', requireAuth, (req, res) => {
    const u = req.user!
    res.json({
      user: {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        organizationId: u.organizationId,
      },
      organization: u.organization,
    })
  })
}
