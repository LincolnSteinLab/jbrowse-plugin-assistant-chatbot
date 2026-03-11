import PluginManager from '@jbrowse/core/PluginManager'
import { AbstractSessionModel, SessionWithAddTracks } from '@jbrowse/core/util'

import { IChatWidgetModel } from '../components/model/ChatbotWidgetModel'

import { AddTemporaryAssemblyTool } from './AddTemporaryAssemblyTool'
import { AddTrackTool } from './AddTrackTool'
import { ApiKeyVaultTool } from './ApiKeyVault'
import { JBrowseConfigTool } from './JBrowseConfig'
import { JBrowseDocumentationTool } from './JBrowseDocumentation'
import { ListAssembliesTool } from './ListAssembliesTool'
import { ListTracksTool } from './ListTracksTool'
import { NavigateTool } from './NavigateTool'
import { OpenViewTool } from './OpenViewTool'
import { SearchFeaturesTool } from './SearchFeaturesTool'
import { ToggleTracksTool } from './ToggleTracksTool'
import { ViewsTool } from './ViewsTool'

export function getTools(
  pluginManager: PluginManager,
  session: AbstractSessionModel,
  model?: IChatWidgetModel,
) {
  const { assemblyManager, jbrowse, textSearchManager, views } = session
  const addView = session.addView.bind(session)
  return {
    addTemporaryAssembly: AddTemporaryAssemblyTool(session),
    addTrack: AddTrackTool(session as SessionWithAddTracks),
    jbrowseConfig: JBrowseConfigTool(jbrowse),
    jbrowseDocumentation: JBrowseDocumentationTool({}),
    listAssemblies: ListAssembliesTool(session),
    listTracks: ListTracksTool(session),
    navigate: NavigateTool({ assemblyManager, views, session, addView }),
    openView: OpenViewTool({
      addView,
      viewTypes: pluginManager.getViewElements(),
    }),
    searchFeatures: SearchFeaturesTool({ textSearchManager, session }),
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
