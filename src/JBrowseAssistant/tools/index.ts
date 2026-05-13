import PluginManager from '@jbrowse/core/PluginManager'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { BaseTrackModel } from '@jbrowse/core/pluggableElementTypes'
import { AbstractSessionModel } from '@jbrowse/core/util'

import { IChatWidgetModel } from '../components/model/ChatbotWidgetModel'

import { ApiKeyVaultTool } from './ApiKeyVault'
import { BookmarkWorkflowTool } from './BookmarkWorkflowTool'
import { ConfigDiagnosticTool } from './ConfigDiagnosticTool'
import { EnsureViewTool } from './EnsureViewTool'
import { FindFeatureTool } from './FindFeatureTool'
import { NavigateGenomeTool } from './NavigateGenomeTool'
import { SVInspectorBootstrapTool } from './SVInspectorBootstrapTool'
import { SessionShareAssistantTool } from './SessionShareAssistantTool'
import { SessionSnapshotTool } from './SessionSnapshotTool'
import { SetTrackVisibilityTool } from './SetTrackVisibilityTool'
import { SyntenySetupTool } from './SyntenySetupTool'
import { WorkflowOrchestratorTool } from './WorkflowOrchestratorTool'

export function getTools(
  pluginManager: PluginManager,
  session: AbstractSessionModel,
  model?: IChatWidgetModel,
) {
  const { assemblyManager, sessionTracks, textSearchManager, tracks, views } =
    session
  const allTracks = [
    ...(sessionTracks ?? []),
    ...tracks,
  ] as (AnyConfigurationModel & BaseTrackModel)[]
  return {
    sessionSnapshot: SessionSnapshotTool({ allTracks, assemblyManager, views }),
    ensureView: EnsureViewTool({
      addView: session.addView.bind(session),
      viewTypes: pluginManager.getViewElements(),
      views,
    }),
    findFeature: FindFeatureTool({ assemblyManager, textSearchManager, views }),
    navigateGenome: NavigateGenomeTool(views),
    setTrackVisibility: SetTrackVisibilityTool({
      allTracks,
      assemblyManager,
      views,
    }),
    bookmarkWorkflow: BookmarkWorkflowTool(views),
    configDiagnostic: ConfigDiagnosticTool({
      allTracks,
      assemblyManager,
      views,
    }),
    sessionShareAssistant: SessionShareAssistantTool({ allTracks, views }),
    syntenySetup: SyntenySetupTool({ allTracks, assemblyManager, views }),
    svInspectorBootstrap: SVInspectorBootstrapTool(allTracks),
    workflowOrchestrator: WorkflowOrchestratorTool({}),
    ...(model && {
      apiKeyVault: ApiKeyVaultTool({
        provider: model.settingsForm.settings.provider,
        getApiKey: model.apiKeyVault.get,
      }),
    }),
  }
}
