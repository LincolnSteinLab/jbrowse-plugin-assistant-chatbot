import jbrowseAmbiguityProtocol from './jbrowse-ambiguity-protocol/SKILL.md'
import jbrowseConfigDiagnostics from './jbrowse-config-diagnostics/SKILL.md'
import jbrowsePlanningDiscipline from './jbrowse-planning-discipline/SKILL.md'
import jbrowseReproducibility from './jbrowse-reproducibility/SKILL.md'
import jbrowseSessionSharing from './jbrowse-session-sharing/SKILL.md'
import jbrowseSessionTriage from './jbrowse-session-triage/SKILL.md'
import jbrowseSubagentRouting from './jbrowse-subagent-routing/SKILL.md'
import jbrowseTrackResolution from './jbrowse-track-resolution/SKILL.md'
import jbrowseWorkflowOrchestration from './jbrowse-workflow-orchestration/SKILL.md'
import configDiagnosticsSubagent from './subagents/config-diagnostics/SKILL.md'
import sessionAnalyzerSubagent from './subagents/session-analyzer/SKILL.md'

export interface DeepAgentFileData {
  content: string[]
  created_at: string
  modified_at: string
}

function createFileData(content: string): DeepAgentFileData {
  const now = new Date().toISOString()
  return {
    content: content.trim().split('\n'),
    created_at: now,
    modified_at: now,
  }
}

export const builtInDeepAgentSkillPaths = ['/skills/']

const markdownSkillFiles = {
  '/skills/jbrowse-session-triage/SKILL.md': jbrowseSessionTriage,
  '/skills/jbrowse-track-resolution/SKILL.md': jbrowseTrackResolution,
  '/skills/jbrowse-config-diagnostics/SKILL.md': jbrowseConfigDiagnostics,
  '/skills/jbrowse-ambiguity-protocol/SKILL.md': jbrowseAmbiguityProtocol,
  '/skills/jbrowse-reproducibility/SKILL.md': jbrowseReproducibility,
  '/skills/jbrowse-planning-discipline/SKILL.md': jbrowsePlanningDiscipline,
  '/skills/jbrowse-subagent-routing/SKILL.md': jbrowseSubagentRouting,
  '/skills/jbrowse-workflow-orchestration/SKILL.md':
    jbrowseWorkflowOrchestration,
  '/skills/jbrowse-session-sharing/SKILL.md': jbrowseSessionSharing,
  '/skills/subagents/session-analyzer/SKILL.md': sessionAnalyzerSubagent,
  '/skills/subagents/config-diagnostics/SKILL.md': configDiagnosticsSubagent,
} satisfies Record<string, string>

export function getBuiltInDeepAgentSkillFiles(): Record<
  string,
  DeepAgentFileData
> {
  return Object.fromEntries(
    Object.entries(markdownSkillFiles).map(([path, content]) => [
      path,
      createFileData(content),
    ]),
  )
}
