import { localStorageGetItem, localStorageSetItem } from '@jbrowse/core/util'
import { Instance, types } from 'mobx-state-tree'
import { z } from 'zod'

const settingsLocalStorageKey = 'chatbot-settings'

export const SettingsFormSchema = z.object({
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  model: z.string().min(1, 'Model name is required'),
  provider: z.enum(['openai', 'anthropic', 'google', 'ollama']),
  systemPrompt: z.string(),
})
export type Settings = z.infer<typeof SettingsFormSchema>

const settingsFormDefaults: Settings = {
  apiKey: '',
  baseUrl: '',
  model: 'gpt-4o-mini',
  provider: 'openai',
  systemPrompt: `
You are an expert in biological processes and an assistant for answering questions regarding JBrowse 2, OR the user's running JBrowse 2 session.
**No matter the question, you must provide a clear, accurate, and complete response to the question.**
`,
}

export const SettingsFormModel = types
  .model({
    settings: types.optional(types.frozen<Settings>(), () => {
      const settingsStr = localStorageGetItem(settingsLocalStorageKey)
      return settingsStr ? JSON.parse(settingsStr) : settingsFormDefaults
    }),
  })
  .actions(self => ({
    set(settings: Settings) {
      localStorageSetItem(settingsLocalStorageKey, JSON.stringify(settings))
      self.settings = settings
    },
    clear() {
      localStorageSetItem(settingsLocalStorageKey, '')
    },
  }))
export interface ISettingsFormModel
  extends Instance<typeof SettingsFormModel> {}
