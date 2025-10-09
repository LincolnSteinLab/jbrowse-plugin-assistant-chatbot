import { localStorageGetItem, localStorageSetItem } from '@jbrowse/core/util'
import { Instance, types } from 'mobx-state-tree'
import { z } from 'zod'

import { ChatModelProviders } from '@/JBrowseAssistant/agent/ChatModel'

const settingsLocalStorageKey = 'chatbot-settings'

const ProviderSettingsSchema = z
  .object({
    baseUrl: z.string().optional(),
    model: z.string().min(1, 'Model name is required'),
    systemPrompt: z.string().optional(),
    temperature: z.number().min(0).max(100).optional(),
  })
  .optional()

export const SettingsFormSchema = z.object({
  provider: z.enum(ChatModelProviders),
  providerSettings: z.object({
    openai: ProviderSettingsSchema,
    anthropic: ProviderSettingsSchema,
    google: ProviderSettingsSchema,
    ollama: ProviderSettingsSchema,
  }),
  defaultSystemPrompt: z.string(),
  useProviderSystemPrompt: z.boolean(),
})
export type Settings = z.infer<typeof SettingsFormSchema>

const settingsFormDefaults: Settings = {
  provider: 'openai',
  defaultSystemPrompt: `
You are an expert in biological processes and an assistant for answering questions regarding JBrowse 2, OR the user's running JBrowse 2 session.
**No matter the question, you must provide a clear, accurate, and complete response to the question.**
`,
  useProviderSystemPrompt: false,
  providerSettings: {
    openai: {
      model: 'gpt-4o-mini',
    },
    anthropic: {
      model: 'claude-3-5-haiku-latest',
    },
    google: {
      model: 'gemini-2.5-flash-lite',
    },
    ollama: {
      baseUrl: 'http://localhost:11434',
      model: 'qwen3:0.6b',
    },
  },
}

export const SettingsFormModel = types
  .model({
    settings: types.optional(types.frozen<Settings>(), () => {
      const settingsStr = localStorageGetItem(settingsLocalStorageKey)
      if (!settingsStr) return settingsFormDefaults
      const parsed = SettingsFormSchema.safeParse(JSON.parse(settingsStr))
      return parsed.success ? parsed.data : settingsFormDefaults
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
