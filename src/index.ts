import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import WidgetType from '@jbrowse/core/pluggableElementTypes/WidgetType'
import { isAbstractMenuManager, SessionWithWidgets } from '@jbrowse/core/util'
import SmartToyIcon from '@mui/icons-material/SmartToy'

import { version } from '../package.json'
import {
  ReactComponent as ChatbotWidgetReactComponent,
  ChatWidgetModel,
} from './ChatbotWidget'

const configSchema = ConfigurationSchema('ChatbotWidget', {})

export default class ConfigAssistantPlugin extends Plugin {
  name = 'ConfigAssistantPlugin'
  version = version

  install(pluginManager: PluginManager) {
    pluginManager.addWidgetType(() => {
      return new WidgetType({
        name: 'ChatbotWidget',
        heading: 'Chatbot Heading',
        configSchema: configSchema,
        stateModel: ChatWidgetModel,
        ReactComponent: ChatbotWidgetReactComponent,
      })
    })
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToMenu('Tools', {
        label: 'Chatbot',
        icon: SmartToyIcon,
        onClick: (session: SessionWithWidgets) => {
          let chatbotWidget = session.widgets.get('Chatbot')
          chatbotWidget ??= session.addWidget('ChatbotWidget', 'Chatbot')
          session.showWidget(chatbotWidget)
        },
      })
    }
  }
}
