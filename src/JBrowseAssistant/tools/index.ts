import PluginManager from '@jbrowse/core/PluginManager'
import { AbstractSessionModel } from '@jbrowse/core/util'

import { IChatWidgetModel } from '../components/model/ChatbotWidgetModel'

import { ApiKeyVaultTool } from './ApiKeyVault'
import { JBrowseConfigTool } from './JBrowseConfig'
import { JBrowseDocumentationTool } from './JBrowseDocumentation'
import { OpenViewTool } from './OpenViewTool'
import { SearchAndNavigateLGVTool, ViewsTool } from './SearchAndNavigateLGVTool'
import { SetCompactDisplayTool } from './SetCompactDisplayTool'
import { ToggleTracksTool } from './ToggleTracksTool'

export function getTools(
  pluginManager: PluginManager,
  session: AbstractSessionModel,
  model?: IChatWidgetModel,
) {
  const { assemblyManager, jbrowse, textSearchManager, views } = session
  return {
    jbrowseConfig: JBrowseConfigTool(jbrowse),
    jbrowseDocumentation: JBrowseDocumentationTool({}),
    openView: OpenViewTool({
      addView: session.addView.bind(session),
      viewTypes: pluginManager.getViewElements(),
    }),
    searchAndNavigateLGV: SearchAndNavigateLGVTool({
      assemblyManager,
      textSearchManager,
      views,
    }),
    setCompactDisplay: SetCompactDisplayTool(views),
    toggletracks: ToggleTracksTool(views),
    views: ViewsTool(views),
    ...(model && {
      apiKeyVault: ApiKeyVaultTool({
        provider: model.settingsForm.settings.provider,
        getApiKey: model.apiKeyVault.get,
      }),
    }),
  }
}
