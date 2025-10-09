import { localStorageGetItem, localStorageSetItem } from '@jbrowse/core/util'
import {
  decryptWithDetail,
  DetailedDecryptResult,
  encrypt,
  encryptWithDetail,
  generateSalt,
  importKey,
} from '@metamask/browser-passworder'
import { JSONType } from 'zod/dist/types/v4/core/util'

export class SecretsVault<T extends Record<string, JSONType>> {
  name: string
  #vault?: DetailedDecryptResult // private cache

  constructor(name: string) {
    this.name = name
  }

  #status(): 'locked' | 'unlocked' | 'unset' {
    if (this.#vault) return 'unlocked'
    if (localStorageGetItem(this.name)) return 'locked'
    return 'unset'
  }

  #clear(): void {
    this.#vault = undefined
    localStorage.removeItem(this.name)
  }

  #exists(key: keyof T): boolean {
    return !!(this.#vault?.vault as T | undefined)?.[key]
  }

  /*
   * #initialize(password):
   * - returns if vault is in cache (this.#vault)
   * - returns if encrypted vault is in localStorage
   * - initializes empty vault, encryption key, & cache (this.#vault)
   **/
  async #initialize(password: string): Promise<void> {
    if (this.#vault) return
    const vaultStr = localStorageGetItem(this.name)
    if (vaultStr) {
      this.#vault = await decryptWithDetail(password, vaultStr)
      return
    }
    const salt = generateSalt()
    const { vault, exportedKeyString } = await encryptWithDetail(password, {}, salt)
    localStorageSetItem(this.name, vault)
    this.#vault = {
      vault: {},
      exportedKeyString,
      salt,
    }
  }

  /* #load(password):
   * - returns cached vault if available
   * - returns empty object if not yet initialized
   * - throws if vault not cached & no password provided
   * - decrypts vault from localStorage with password, caches it, & returns it
   * - throws if incorrect password
   **/
  async #load(password?: string): Promise<T> {
    if (this.#vault) return this.#vault.vault as T
    const vaultStr = localStorageGetItem(this.name)
    if (!vaultStr) return {} as T
    if (!password) throw new Error('Missing password')
    this.#vault = await decryptWithDetail(password, vaultStr)
    return this.#vault.vault as T
  }

  async #loadOne(key: keyof T, password?: string): Promise<T[keyof T]> {
    const vault = await this.#load(password)
    return vault[key]
  }

  /* #save(password):
   * - throws if vault not cached & no password provided
   * - initializes vault cache if not yet initialized
   * - encrypts cached vault & saves to localStorage
   **/
  async #save(password?: string): Promise<void> {
    if (!this.#vault) {
      if (!password) throw new Error('Missing password')
      await this.#initialize(password) // sets #vault
    }
    const key = await importKey(this.#vault!.exportedKeyString)
    const vaultStr = await encrypt('', this.#vault!.vault, key, this.#vault!.salt)
    localStorageSetItem(this.name, vaultStr)
  }

  async #saveOne(
    key: keyof T,
    value: T[keyof T],
    password?: string,
  ): Promise<void> {
    if (!this.#vault) {
      if (!password) throw new Error('Missing password')
      await this.#initialize(password) // sets #vault
    }
    const vault = await this.#load(password)
    vault[key] = value
    this.#vault!.vault = vault
    await this.#save(password)
  }

  async #changePassword(
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    const vault = await this.#load(oldPassword)
    const oldCache = this.#vault
    try {
      this.#clear()
      await this.#initialize(newPassword)
      this.#vault!.vault = vault
      await this.#save(newPassword)
    } catch (error) {
      this.#vault = oldCache
      throw error
    }
  }

  public status(): 'locked' | 'unlocked' | 'unset' {
    return this.#status()
  }

  public clear(): void {
    this.#clear()
  }

  public exists(key: keyof T): boolean {
    return this.#exists(key)
  }

  public async get(key: keyof T, password?: string): Promise<T[keyof T]> {
    return await this.#loadOne(key, password)
  }

  public async set(
    key: keyof T,
    value: T[keyof T],
    password?: string,
  ): Promise<void> {
    await this.#saveOne(key, value, password)
  }

  public async changePassword(
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    await this.#changePassword(oldPassword, newPassword)
  }
}
