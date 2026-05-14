import type { Organization, Role } from '@prisma/client'
import type { NextFunction, Request, Response } from 'express'
import { prisma } from '../prisma.js'

export type AuthedUser = {
  id: string
  email: string
  name: string
  role: Role
  organizationId: string
  createdAt: Date
  updatedAt: Date
  organization: Pick<Organization, 'id' | 'name'>
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthedUser
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.session?.userId
  if (!userId || typeof userId !== 'string') {
    res.status(401).json({ error: 'Sessão inválida ou expirada.' })
    return
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { organization: { select: { id: true, name: true } } },
  })

  if (!user) {
    req.session.destroy(() => undefined)
    res.status(401).json({ error: 'Utilizador não encontrado.' })
    return
  }

  req.user = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    organizationId: user.organizationId,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    organization: user.organization,
  }
  next()
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Não autenticado.' })
      return
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Permissões insuficientes.' })
      return
    }
    next()
  }
}
