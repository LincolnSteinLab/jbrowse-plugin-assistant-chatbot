import PluginManager from '@jbrowse/core/PluginManager'
import { AbstractSessionModel } from '@jbrowse/core/util'

import { IChatWidgetModel } from '../components/model/ChatbotWidgetModel'

import { ApiKeyVaultTool } from './ApiKeyVault'
import { EnsureViewTool } from './EnsureViewTool'
import { FindFeatureTool } from './FindFeatureTool'
import { NavigateGenomeTool } from './NavigateGenomeTool'
import { SessionSnapshotTool } from './SessionSnapshotTool'
import { SetTrackVisibilityTool } from './SetTrackVisibilityTool'

export function getTools(
  pluginManager: PluginManager,
  session: AbstractSessionModel,
  model?: IChatWidgetModel,
) {
  const { assemblyManager, textSearchManager, views } = session
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
    ...(model && {
      apiKeyVault: ApiKeyVaultTool({
        provider: model.settingsForm.settings.provider,
        getApiKey: model.apiKeyVault.get,
      }),
    }),
  }
}
