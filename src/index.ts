import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import WidgetType from '@jbrowse/core/pluggableElementTypes/WidgetType'
import {
  AbstractSessionModel,
  isAbstractMenuManager,
  SessionWithWidgets,
} from '@jbrowse/core/util'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import { version } from '../package.json'
import {
  ReactComponent as ChatbotWidgetReactComponent,
  stateModel as chatbotWidgetStateModel,
} from './ChatbotWidget'
import {
  ReactComponent as HelloViewReactComponent,
  stateModel as helloViewStateModel,
} from './HelloView'

const configSchema = ConfigurationSchema('ChatbotWidget', {})

export default class ConfigAssistantPlugin extends Plugin {
  name = 'ConfigAssistantPlugin'
  version = version

  install(pluginManager: PluginManager) {
    pluginManager.addViewType(() => {
      return new ViewType({
        name: 'HelloView',
        stateModel: helloViewStateModel,
        ReactComponent: HelloViewReactComponent,
      })
    })
    pluginManager.addWidgetType(() => {
      return new WidgetType({
        name: 'ChatbotWidget',
        heading: 'Chatbot Heading',
        configSchema: configSchema,
        stateModel: chatbotWidgetStateModel,
        ReactComponent: ChatbotWidgetReactComponent,
      })
    })
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToMenu('Add', {
        label: 'Hello View',
        onClick: (session: AbstractSessionModel) => {
          session.addView('HelloView', {})
        },
      })
      pluginManager.rootModel.appendToMenu('Tools', {
        label: 'Chatbot',
        icon: SmartToyIcon,
        onClick: (session: SessionWithWidgets) => {
          let chatbotWidget = session.widgets.get('Chatbot')
          if (!chatbotWidget) {
            chatbotWidget = session.addWidget('ChatbotWidget', 'Chatbot')
          }
          session.showWidget(chatbotWidget)
        },
      })
    }
  }
}
