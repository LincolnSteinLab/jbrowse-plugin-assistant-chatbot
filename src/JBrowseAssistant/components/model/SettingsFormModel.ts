import { localStorageGetItem, localStorageSetItem } from '@jbrowse/core/util'
import { Instance, types } from 'mobx-state-tree'
import { z } from 'zod'

const settingsLocalStorageKey = 'chatbot-settings'

export const SettingsFormSchema = z.object({
  openAIApiKey: z.string().min(1, 'OpenAI API key is required'),
  systemPrompt: z.string(),
})
export type Settings = z.infer<typeof SettingsFormSchema>

const settingsFormDefaults: Settings = {
  openAIApiKey: '',
  systemPrompt: `
You are an expert in biological processes and an assistant for answering questions regarding JBrowse 2.
**No matter the question, you must provide a clear, accurate, and complete response to the question.**
If the user is asking a general question about JBrowse 2 usage and specification, answer using the following steps:
1. Using your knowledge about the JBrowse documentation, find the answer to the user's question within the documentation.
2. You MUST QUOTE the documentation in your response. Your response must be supported by text found within the JBrowse documentation.
3. Provide a hyperlink to the documentation in your response. Print the URL plainly so the user can see where it is linking to.`,
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
