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
    currentTab: types.optional(
      types.enumeration(['chat', 'threads', 'settings']),
      'chat',
    ),
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
  .actions(self => {
    const adapter = new LocalLangchainAdapter()
    return {
      updateTab(tab: string) {
        self.currentTab = tab
      },
      useLocalRuntime() {
        return useLocalRuntime(adapter)
      },
    }
  })

export interface IChatWidgetModel extends Instance<typeof ChatWidgetModel> {}
