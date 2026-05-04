import { localStorageGetItem, localStorageSetItem } from '@jbrowse/core/util'
import { Instance, types } from '@jbrowse/mobx-state-tree'
import { z } from 'zod'

import {
  ChatModelProvider,
  ChatModelProviders,
} from '@/JBrowseAssistant/agent/ChatModel'

const settingsLocalStorageKey = 'chatbot-settings'

/** Increment when settingsFormDefaults changes to auto-reset stored settings for existing users. */
const SETTINGS_VERSION = 2

const ProviderSettingsSchema = z
  .object({
    baseUrl: z.string().optional(),
    model: z.string().min(1, 'Model name is required'),
    systemPrompt: z.string().optional(),
    temperature: z.number().min(0).max(100).optional(),
  })
  .optional()

export const SettingsFormSchema = z.object({
  version: z.number().optional(),
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
  version: SETTINGS_VERSION,
  provider: 'openai',
  defaultSystemPrompt: `You are an expert assistant for JBrowse 2 and genomics-focused analysis.

Use available tools to inspect or change the live JBrowse session when a user asks for session-aware actions.
Before taking stateful actions, gather enough context from the current session.
Prefer exact identifiers returned by tools over guessed names.
If an action is ambiguous or unsafe, ask a concise clarifying question.
When you complete a tool-assisted step, summarize what changed in plain language.

Always provide clear, accurate, and complete responses.`,
  useProviderSystemPrompt: false,
  providerSettings: {
    openai: {
      model: 'gpt-5.4-nano',
    },
    anthropic: {
      model: 'claude-3-5-haiku-latest',
    },
    google: {
      model: 'gemini-flash-lite-latest',
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
      if (!parsed.success) return settingsFormDefaults
      // Migrate stale settings when SETTINGS_VERSION increments
      if ((parsed.data.version ?? 0) < SETTINGS_VERSION)
        return settingsFormDefaults
      return parsed.data
    }),
  })
  .actions(self => ({
    set(settings: Settings) {
      const versioned: Settings = { ...settings, version: SETTINGS_VERSION }
      localStorageSetItem(settingsLocalStorageKey, JSON.stringify(versioned))
      self.settings = versioned
    },
    setProvider(provider: ChatModelProvider) {
      self.settings = {
        ...self.settings,
        provider,
      }
      localStorageSetItem(
        settingsLocalStorageKey,
        JSON.stringify(self.settings),
      )
    },
    clear() {
      localStorageSetItem(settingsLocalStorageKey, '')
    },
    resetToDefaults() {
      localStorageSetItem(
        settingsLocalStorageKey,
        JSON.stringify(settingsFormDefaults),
      )
      self.settings = settingsFormDefaults
    },
  }))
export interface ISettingsFormModel
  extends Instance<typeof SettingsFormModel> {}
