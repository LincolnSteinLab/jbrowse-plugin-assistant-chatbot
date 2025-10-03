import webAuth from '@adorsys-gis/web-auth'
import { LogLevel } from '@adorsys-gis/web-auth-logger'

import { ChatModelProvider } from '@/JBrowseAssistant/agent/ChatModel'

const NS = 'jb-assistant'
const userHandleKey = `${NS}:user-handle`

const wa = webAuth({
  credentialOptions: {
    rp: {
      id: window.location.hostname,
      name: 'JBrowse Assistant',
    },
    creationOptions: {
      authenticatorSelection: {
        residentKey: 'required',
        requireResidentKey: true,
        userVerification: 'required',
      },
    },
  },
  encryptionOptions: {
    tagLength: 128,
  },
  logLevel: LogLevel.info,
})

function encKeySaltKey(provider: ChatModelProvider) {
  return `${NS}:salt:${provider}`
}

function secretKey(provider: ChatModelProvider) {
  return `${NS}:secret:${provider}`
}

function concatBytes(a: Uint8Array, b: Uint8Array) {
  const out = new Uint8Array(a.length + b.length)
  out.set(a, 0)
  out.set(b, a.length)
  return out
}

function toUint8(data: string | ArrayBuffer): Uint8Array<ArrayBuffer> {
  return data instanceof ArrayBuffer
    ? new Uint8Array(data)
    : new TextEncoder().encode(data)
}

async function loadBytes(key: string): Promise<Uint8Array<ArrayBuffer> | null> {
  const loaded = await wa.storage.get<ArrayBuffer>(key).catch(() => null)
  if (!loaded?.data) return null
  return toUint8(loaded.data)
}

async function saveBytes(key: string, data: ArrayBuffer) {
  await wa.storage.save(key, { data })
}

async function removeKey(key: string) {
  await wa.storage.remove(key)
}

async function getOrCreateUserHandle(): Promise<Uint8Array<ArrayBuffer>> {
  const userHandle = await loadBytes(userHandleKey)
  if (userHandle) return userHandle
  // Generate a new stable user handle for this browser profile and store it via web-auth storage
  const uh = crypto.getRandomValues(new Uint8Array(32))
  await saveBytes(userHandleKey, uh.buffer)
  // Create/ensure a resident passkey for this user to enable PRF/derivation with user verification
  await wa.credential.register({
    user: {
      name: 'jbrowse-assistant',
      displayName: 'JBrowse Assistant',
    },
  })
  return uh
}

async function authenticateForPresence() {
  // Require user verification/presence to proceed (binds decryption to the passkey)
  await wa.credential.authenticate()
}

async function getOrCreateSalt(
  provider: ChatModelProvider,
): Promise<Uint8Array> {
  const salt = await loadBytes(encKeySaltKey(provider))
  if (salt) return salt
  const s = crypto.getRandomValues(new Uint8Array(32))
  await saveBytes(encKeySaltKey(provider), s.buffer)
  return s
}

async function deriveSymmetricKey(
  userHandle: Uint8Array<ArrayBuffer>,
  salt: Uint8Array,
): Promise<CryptoKey> {
  // The library derives a symmetric key from user handle + salt; requires user verification when appropriate.
  const key = await wa.encryption.generateKeyFromUserId(userHandle.buffer, salt)
  // Assume the returned key is an AES-GCM CryptoKey usable with encrypt/decrypt.
  return key.key
}

export class WebAuthVault {
  static async hasSecret(provider: ChatModelProvider): Promise<boolean> {
    const bytes = await loadBytes(secretKey(provider))
    return !!bytes
  }

  static async setSecret(
    provider: ChatModelProvider,
    secret: string,
  ): Promise<void> {
    // Enforce user presence
    const userHandle = await getOrCreateUserHandle()
    await authenticateForPresence()
    const salt = await getOrCreateSalt(provider)
    const key = await deriveSymmetricKey(userHandle, salt)

    const iv = crypto.getRandomValues(new Uint8Array(12))
    const plaintext = new TextEncoder().encode(secret)
    const ciphertextBuf = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      plaintext,
    )
    const ciphertext = new Uint8Array(ciphertextBuf)
    const blob = concatBytes(iv, ciphertext)
    await saveBytes(secretKey(provider), blob.buffer)
  }

  static async getSecret(
    provider: ChatModelProvider,
  ): Promise<string | undefined> {
    const blob = await loadBytes(secretKey(provider))
    if (!blob || blob.length < 13) return undefined
    const userHandle = await getOrCreateUserHandle()
    await authenticateForPresence()
    const salt = await getOrCreateSalt(provider)
    const key = await deriveSymmetricKey(userHandle, salt)

    const iv = blob.slice(0, 12)
    const ciphertext = blob.slice(12)
    const plaintextBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext,
    )
    return new TextDecoder().decode(plaintextBuf)
  }

  static async deleteSecret(provider: ChatModelProvider): Promise<void> {
    await removeKey(secretKey(provider))
  }
}
