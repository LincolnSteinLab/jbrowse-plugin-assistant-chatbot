import { useWebMCPResource } from '@mcp-b/react-webmcp'
import { FileData } from 'deepagents'
import React from 'react'

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

export const skillsPath = '/skills/'

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

export function getSkills(): Record<
  string,
  FileData & { mcp: () => React.JSX.Element }
> {
  const now = new Date().toISOString()
  return Object.fromEntries(
    Object.entries(markdownSkillFiles).map(([uri, content]) => {
      const match =
        /^---\s*name:\s*(?<name>\S*)\s*\ndescription:\s*(?<description>.*(?=\n---))/s.exec(
          content,
        )
      return [
        uri,
        {
          content,
          mimeType: 'text/markdown',
          created_at: now,
          modified_at: now,
          mcp: function MCPResource() {
            useWebMCPResource({
              uri,
              name: match?.groups?.name ?? uri,
              description: match?.groups?.description,
              mimeType: 'text/markdown',
              read: () =>
                Promise.resolve({
                  contents: [
                    {
                      uri,
                      mimeType: 'text/markdown',
                      text: content,
                    },
                  ],
                }),
            })
            return <></>
          },
        },
      ]
    }),
  )
}
