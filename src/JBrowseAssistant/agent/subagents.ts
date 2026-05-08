import { SubAgent } from 'deepagents'
import { z } from 'zod'

const SESSION_ANALYZER_SKILLS = ['/skills/subagents/session-analyzer/']
const CONFIG_DIAGNOSTICS_SKILLS = ['/skills/subagents/config-diagnostics/']

export const builtInSubAgents: SubAgent[] = [
  {
    name: 'session-analyzer',
    description:
      'Analyzes current JBrowse session state before action. Use when the parent agent needs a structured snapshot summary (active view, assembly, visible tracks, and next-step options) prior to any navigation or track mutation.',
    systemPrompt:
      'You are a read-only JBrowse session analysis assistant. Call SessionSnapshot and produce a concise structured analysis. Do not call mutating tools and do not claim changes were applied.',
    skills: SESSION_ANALYZER_SKILLS,
    responseFormat: z.object({
      activeAssembly: z
        .string()
        .nullable()
        .describe('The assembly name currently active in the view'),
      viewType: z
        .string()
        .nullable()
        .describe('The type of the active view, e.g. LinearGenomeView'),
      visibleTrackIds: z
        .array(z.string())
        .describe('Track IDs currently shown in the view'),
      availableTrackCount: z
        .number()
        .describe('Total number of tracks available in the session'),
      suggestedActions: z
        .array(z.string())
        .describe(
          'Concrete next-step suggestions based on the session state and the user request',
        ),
      summary: z
        .string()
        .describe(
          'One-paragraph plain-language summary of the current session state',
        ),
    }),
  },
  {
    name: 'config-diagnostics',
    description:
      'Diagnoses JBrowse configuration and compatibility issues (assembly mismatches, missing tracks, view constraints, rendering limits). Use when behavior is failing or unclear and the parent agent needs a focused diagnostic report before deciding actions.',
    systemPrompt:
      'You are a read-only JBrowse configuration diagnostics assistant. Inspect current state with SessionSnapshot and return a structured diagnostic report. Be specific about assembly names and track IDs. Do not call mutating tools.',
    skills: CONFIG_DIAGNOSTICS_SKILLS,
    responseFormat: z.object({
      issues: z.array(
        z.object({
          severity: z.enum(['error', 'warning', 'info']),
          message: z.string().describe('Description of the issue'),
          suggestion: z
            .string()
            .optional()
            .describe('Concrete remediation step'),
        }),
      ),
      summary: z
        .string()
        .describe('Short plain-language summary of the diagnostic findings'),
    }),
  },
]
