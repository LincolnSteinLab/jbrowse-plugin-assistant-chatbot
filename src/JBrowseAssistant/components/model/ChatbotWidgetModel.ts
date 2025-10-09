import { useLocalRuntime } from '@assistant-ui/react'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { Instance, types } from 'mobx-state-tree'

import { LocalLangchainAdapter } from '@/JBrowseAssistant/LocalLangchainAdapter'

import { ApiKeyVaultModel } from './ApiKeyVaultModel'
import { SettingsFormModel } from './SettingsFormModel'

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
      },
    }
  })

export interface IChatWidgetModel extends Instance<typeof ChatWidgetModel> {}
