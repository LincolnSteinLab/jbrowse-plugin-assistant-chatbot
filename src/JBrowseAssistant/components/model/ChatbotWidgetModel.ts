import { ElementId } from '@jbrowse/core/util/types/mst'
import { Instance, types } from 'mobx-state-tree'

import { ApiKeyVaultModel } from './ApiKeyVaultModel'
import { SettingsFormModel } from './SettingsFormModel'
import { LocalLangchainAdapter } from '@/JBrowseAssistant/LocalLangchainAdapter'
import { useLocalRuntime } from '@assistant-ui/react'

export const ChatWidgetModel = types
  .model({
    id: ElementId,
    type: types.literal('ChatbotWidget'),
    settingsForm: types.optional(SettingsFormModel, () =>
      SettingsFormModel.create(),
    ),
    apiKeyVault: types.optional(ApiKeyVaultModel, () =>
      ApiKeyVaultModel.create(),
    ),
  })
  .views(self => ({
    get isChatReady() {
      return !!self.settingsForm.settings
    },
  }))
  .actions(() => {
    const adapter = new LocalLangchainAdapter()
    return {
      useLocalRuntime() {
        return useLocalRuntime(adapter)
      }
    }
  })

export interface IChatWidgetModel extends Instance<typeof ChatWidgetModel> {}
