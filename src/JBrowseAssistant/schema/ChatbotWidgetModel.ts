import { ElementId } from '@jbrowse/core/util/types/mst'
import { Instance, types } from 'mobx-state-tree'

import { SettingsFormModel } from './SettingsFormModel'

export const ChatWidgetModel = types
  .model({
    id: ElementId,
    type: types.literal('ChatbotWidget'),
    settingsForm: types.optional(SettingsFormModel, () =>
      SettingsFormModel.create(),
    ),
  })
  .views(self => ({
    get isChatReady() {
      return !!self.settingsForm.settings
    },
  }))

export interface IChatWidgetModel extends Instance<typeof ChatWidgetModel> {}
