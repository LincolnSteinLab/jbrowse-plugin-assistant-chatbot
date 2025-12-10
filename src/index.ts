import { version } from '../package.json'

import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import WidgetType from '@jbrowse/core/pluggableElementTypes/WidgetType'
import { isAbstractMenuManager, SessionWithWidgets } from '@jbrowse/core/util'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'

import { ChatbotWidget, ChatWidgetModel, McpProvider } from './JBrowseAssistant'

const configSchema = ConfigurationSchema('ChatbotWidget', {})

export default class AssistantChatbotPlugin extends Plugin {
  name = 'JBrowseAssistantPlugin'
  version = version

  install(pluginManager: PluginManager) {
    pluginManager.addWidgetType(() => {
      return new WidgetType({
        name: 'ChatbotWidget',
        heading: 'JBrowse Assistant',
        configSchema: configSchema,
        stateModel: ChatWidgetModel,
        ReactComponent: ChatbotWidget,
      })
    })
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToMenu('Tools', {
        label: 'Assistant',
        icon: SmartToyIcon,
        onClick: (session: SessionWithWidgets) => {
          let chatbotWidget = session.widgets.get('JBrowseAssistant')
          chatbotWidget ??= session.addWidget(
            'ChatbotWidget',
            'JBrowseAssistant',
          )
          session.showWidget(chatbotWidget)
        },
      })
    }
    if (
      typeof document !== 'undefined' &&
      typeof document.getElementById === 'function' &&
      !document.getElementById('chatbot-mcp')
    ) {
      const mcpElement = document.createElement('div')
      mcpElement.id = 'chatbot-mcp'
      document.body.appendChild(mcpElement)
      const root = createRoot(mcpElement)

      root.render(
        createElement(McpProvider, {
          pluginManager,
          session: pluginManager.rootModel?.session,
        }),
      )
    }
  }
}
