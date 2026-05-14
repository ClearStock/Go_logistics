import { decryptUtf8, encryptUtf8 } from '../crypto/fieldEncryption.js'
import { prisma } from '../prisma.js'
import type { WarehouseApicbaseRegistration, WarehouseTokenState } from '../types/apicbase.js'
import type { WarehouseCredentialStore, WarehouseTokenStore } from './warehouseStores.js'

/**
 * Credenciais e tokens Apicbase por organização (multi-tenant), persistidos em PostgreSQL com segredos encriptados.
 */
export class PrismaOrganizationApicbaseStore implements WarehouseCredentialStore, WarehouseTokenStore {
  constructor(private readonly key: Buffer) {}

  async getRegistration(organizationId: string): Promise<WarehouseApicbaseRegistration | undefined> {
    const org = await prisma.organization.findUnique({ where: { id: organizationId } })
    if (!org?.apicbaseClientId || !org.apicbaseClientSecretEnc) return undefined

    const client_secret = decryptUtf8(org.apicbaseClientSecretEnc, this.key)
    return {
      warehouseId: organizationId,
      credentials: { client_id: org.apicbaseClientId, client_secret },
      oauthRedirectUri: org.apicbaseOAuthRedirectUri ?? '',
      oauthScopes: org.apicbaseOAuthScopes ?? 'accounts+library+stock',
    }
  }

  async upsertRegistration(registration: WarehouseApicbaseRegistration): Promise<void> {
    await prisma.organization.update({
      where: { id: registration.warehouseId },
      data: {
        apicbaseClientId: registration.credentials.client_id,
        apicbaseClientSecretEnc: encryptUtf8(registration.credentials.client_secret, this.key),
        apicbaseOAuthRedirectUri: registration.oauthRedirectUri,
        apicbaseOAuthScopes: registration.oauthScopes,
      },
    })
  }

  async getState(organizationId: string): Promise<WarehouseTokenState | undefined> {
    const org = await prisma.organization.findUnique({ where: { id: organizationId } })
    if (!org?.apicbaseAccessTokenEnc) return undefined

    const mode = org.apicbaseAuthMode
    if (mode === 'service_account') {
      const accessToken = decryptUtf8(org.apicbaseAccessTokenEnc, this.key)
      return {
        warehouseId: organizationId,
        mode: 'service_account',
        serviceAccount: { accessToken },
      }
    }

    if (mode === 'oauth' || (org.apicbaseRefreshTokenEnc && org.apicbaseAccessTokenEnc)) {
      const accessToken = decryptUtf8(org.apicbaseAccessTokenEnc, this.key)
      const refreshToken = org.apicbaseRefreshTokenEnc
        ? decryptUtf8(org.apicbaseRefreshTokenEnc, this.key)
        : ''
      return {
        warehouseId: organizationId,
        mode: 'oauth',
        oauth: {
          accessToken,
          refreshToken,
          accessTokenExpiresAtMs: org.apicbaseAccessExpiresAt?.getTime() ?? 0,
        },
      }
    }

    return undefined
  }

  private tokenUpdateData(
    authMode: 'oauth' | 'service_account',
    accessToken: string,
    refreshToken: string | null,
    accessExpiresAtMs: number | null,
  ) {
    return {
      apicbaseAuthMode: authMode,
      apicbaseAccessTokenEnc: encryptUtf8(accessToken, this.key),
      apicbaseRefreshTokenEnc: refreshToken ? encryptUtf8(refreshToken, this.key) : null,
      apicbaseAccessExpiresAt: accessExpiresAtMs != null ? new Date(accessExpiresAtMs) : null,
    }
  }

  async replaceOAuthTokens(
    organizationId: string,
    next: NonNullable<WarehouseTokenState['oauth']>,
  ): Promise<void> {
    await prisma.organization.update({
      where: { id: organizationId },
      data: this.tokenUpdateData('oauth', next.accessToken, next.refreshToken, next.accessTokenExpiresAtMs),
    })
  }

  async setOAuthTokens(organizationId: string, oauth: NonNullable<WarehouseTokenState['oauth']>): Promise<void> {
    await this.replaceOAuthTokens(organizationId, oauth)
  }

  async setServiceAccountToken(organizationId: string, accessToken: string): Promise<void> {
    await prisma.organization.update({
      where: { id: organizationId },
      data: this.tokenUpdateData('service_account', accessToken, null, null),
    })
  }

  async clearTokens(organizationId: string): Promise<void> {
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        apicbaseAuthMode: null,
        apicbaseAccessTokenEnc: null,
        apicbaseRefreshTokenEnc: null,
        apicbaseAccessExpiresAt: null,
      },
    })
  }

  async clear(organizationId: string): Promise<void> {
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        apicbaseClientId: null,
        apicbaseClientSecretEnc: null,
        apicbaseOAuthRedirectUri: null,
        apicbaseOAuthScopes: 'accounts+library+stock',
        apicbaseAuthMode: null,
        apicbaseAccessTokenEnc: null,
        apicbaseRefreshTokenEnc: null,
        apicbaseAccessExpiresAt: null,
      },
    })
  }
}
