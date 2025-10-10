import { flow, Instance, types } from 'mobx-state-tree'
import { z } from 'zod'

import { ChatModelProvider } from '@/JBrowseAssistant/agent/ChatModel'
import { SecretsVault } from '@/lib/vault'

type ApiKeyVault = Partial<Record<ChatModelProvider, string>>

const vaultLocalStorageKey = 'chatbot-vault'

export const ApiKeyVaultModel = types
  .model({
    isAuthenticating: types.optional(types.boolean, false),
  })
  .extend(self => {
    const apiKeyVault = new SecretsVault<ApiKeyVault>(vaultLocalStorageKey)
    let setPasswordFromPrompt: (password: string) => void = () => {}
    let cancelPasswordPrompt: () => void = () => {}
    const promptPassword = flow(function* promptPassword() {
      self.isAuthenticating = true
      const password = (yield new Promise<string>((resolve, reject) => {
        setPasswordFromPrompt = resolve
        cancelPasswordPrompt = () => reject(new Error('cancelled'))
      })) as string
      self.isAuthenticating = false
      return password
    })
    return {
      views: {
        status() {
          return apiKeyVault.status()
        },
        exists(provider: ChatModelProvider) {
          return apiKeyVault.exists(provider)
        },
      },
      actions: {
        clear() {
          apiKeyVault.clear()
          self.isAuthenticating = false
        },
        get: flow(function* get(provider: ChatModelProvider) {
          try {
            return (yield apiKeyVault.get(provider)) as string | undefined
          } catch {}
          return (yield apiKeyVault.get(
            provider,
            (yield promptPassword()) as string,
          )) as string | undefined
        }),
        set: flow(function* set(provider: ChatModelProvider, apiKey: string) {
          try {
            yield apiKeyVault.set(provider, apiKey)
            return
          } catch {}
          yield apiKeyVault.set(
            provider,
            apiKey,
            (yield promptPassword()) as string,
          )
        }),
        inputPassword(password: string) {
          setPasswordFromPrompt(password)
          self.isAuthenticating = false
        },
        closePasswordPrompt() {
          self.isAuthenticating = false
          cancelPasswordPrompt()
        },
      },
    }
  })
export interface IApiKeyVaultModel extends Instance<typeof ApiKeyVaultModel> {}

export const ApiKeyVaultKeySchema = z.object({
  apiKey: z.string(),
})
export type ApiKeyVaultKey = z.infer<typeof ApiKeyVaultKeySchema>

export const ApiKeyVaultAuthPromptSchema = z.object({
  password: z.string().min(1, 'Password is required'),
})
export type ApiKeyVaultAuth = z.infer<typeof ApiKeyVaultAuthPromptSchema>
