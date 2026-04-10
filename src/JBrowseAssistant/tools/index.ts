import PluginManager from '@jbrowse/core/PluginManager'
import { AbstractSessionModel } from '@jbrowse/core/util'

import { IChatWidgetModel } from '../components/model/ChatbotWidgetModel'

import { ApiKeyVaultTool } from './ApiKeyVault'
import { EnsureViewTool } from './EnsureViewTool'
import { FindFeatureTool } from './FindFeatureTool'
import { JBrowseConfigTool } from './JBrowseConfig'
import { JBrowseDocumentationTool } from './JBrowseDocumentation'
import { NavigateGenomeTool } from './NavigateGenomeTool'
import { OpenViewTool } from './OpenViewTool'
import { SearchAndNavigateLGVTool } from './SearchAndNavigateLGVTool'
import { SessionSnapshotTool } from './SessionSnapshotTool'
import { SetTrackVisibilityTool } from './SetTrackVisibilityTool'
import { ToggleTracksTool } from './ToggleTracksTool'
import { ViewsTool } from './ViewsTool'

export function getTools(
  pluginManager: PluginManager,
  session: AbstractSessionModel,
  model?: IChatWidgetModel,
) {
  const { assemblyManager, jbrowse, textSearchManager, views } = session
  return {
    sessionSnapshot: SessionSnapshotTool(session),
    ensureView: EnsureViewTool({
      addView: session.addView.bind(session),
      viewTypes: pluginManager.getViewElements(),
      views,
    }),
    findFeature: FindFeatureTool({
      assemblyManager,
      textSearchManager,
      views,
    }),
    navigateGenome: NavigateGenomeTool(views),
    setTrackVisibility: SetTrackVisibilityTool({ session, views }),

    // Legacy tools retained for compatibility while v1 tools are adopted.
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
