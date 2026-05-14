import type { WarehouseApicbaseRegistration, WarehouseTokenState } from '../types/apicbase.js'

export interface WarehouseCredentialStore {
  getRegistration(organizationId: string): Promise<WarehouseApicbaseRegistration | undefined>
  upsertRegistration(registration: WarehouseApicbaseRegistration): Promise<void>
}

export interface WarehouseTokenStore {
  getState(organizationId: string): Promise<WarehouseTokenState | undefined>
  replaceOAuthTokens(
    organizationId: string,
    next: NonNullable<WarehouseTokenState['oauth']>,
  ): Promise<void>
  setOAuthTokens(organizationId: string, oauth: NonNullable<WarehouseTokenState['oauth']>): Promise<void>
  setServiceAccountToken(organizationId: string, accessToken: string): Promise<void>
  clearTokens(organizationId: string): Promise<void>
  clear(organizationId: string): Promise<void>
}

/** Implementação em memória (testes / desenvolvimento rápido). */
export class InMemoryWarehouseCredentialStore implements WarehouseCredentialStore {
  private readonly byId = new Map<string, WarehouseApicbaseRegistration>()

  async getRegistration(organizationId: string): Promise<WarehouseApicbaseRegistration | undefined> {
    return this.byId.get(organizationId)
  }

  async upsertRegistration(registration: WarehouseApicbaseRegistration): Promise<void> {
    this.byId.set(registration.warehouseId, registration)
  }
}

export class InMemoryWarehouseTokenStore implements WarehouseTokenStore {
  private readonly byId = new Map<string, WarehouseTokenState>()

  async getState(organizationId: string): Promise<WarehouseTokenState | undefined> {
    return this.byId.get(organizationId)
  }

  async replaceOAuthTokens(
    organizationId: string,
    next: NonNullable<WarehouseTokenState['oauth']>,
  ): Promise<void> {
    this.byId.set(organizationId, {
      warehouseId: organizationId,
      mode: 'oauth',
      oauth: { ...next },
      serviceAccount: undefined,
    })
  }

  async setOAuthTokens(organizationId: string, oauth: NonNullable<WarehouseTokenState['oauth']>): Promise<void> {
    await this.replaceOAuthTokens(organizationId, oauth)
  }

  async setServiceAccountToken(organizationId: string, accessToken: string): Promise<void> {
    this.byId.set(organizationId, {
      warehouseId: organizationId,
      mode: 'service_account',
      oauth: undefined,
      serviceAccount: { accessToken },
    })
  }

  async clearTokens(organizationId: string): Promise<void> {
    this.byId.delete(organizationId)
  }

  async clear(organizationId: string): Promise<void> {
    await this.clearTokens(organizationId)
  }
}
