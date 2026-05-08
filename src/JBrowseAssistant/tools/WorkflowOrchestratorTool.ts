import { z } from 'zod'

import { ToolEnvelope, ok } from './ToolEnvelope'
import { createTool } from './base'

export interface WorkflowOrchestratorData {
  workflow: 'feature_triage' | 'synteny_setup' | 'sv_inspector_bootstrap'
  phase: 'start' | 'diagnose' | 'act' | 'verify'
  requiredInputs: string[]
  clarificationQuestions: string[]
  nextActions: {
    stepId: string
    title: string
    recommendedTool?: string
    reason: string
  }[]
  completionCriteria: string[]
}

function getWorkflowContract(
  workflow: WorkflowOrchestratorData['workflow'],
  phase: WorkflowOrchestratorData['phase'],
): Omit<WorkflowOrchestratorData, 'workflow' | 'phase'> {
  if (workflow === 'feature_triage') {
    return {
      requiredInputs:
        phase === 'start'
          ? ['feature query or locus string']
          : ['resolved feature candidate or exact location'],
      clarificationQuestions:
        phase === 'start'
          ? ['Which assembly should I use if multiple are available?']
          : [],
      nextActions: [
        {
          stepId: 'ft-1',
          title: 'Capture current session context',
          recommendedTool: 'SessionSnapshot',
          reason: 'Need current assembly, view state, and available tracks.',
        },
        {
          stepId: 'ft-2',
          title: 'Resolve feature candidate or locus',
          recommendedTool: 'FindFeature',
          reason: 'Translate user query into concrete genomic target(s).',
        },
        {
          stepId: 'ft-3',
          title: 'Navigate to selected feature location',
          recommendedTool: 'NavigateGenome',
          reason: 'Move view to a concrete coordinate range.',
        },
      ],
      completionCriteria: [
        'A single target locus is selected',
        'At least one LinearGenomeView is navigated to that locus',
        'Ambiguity has been explicitly resolved if multiple candidates existed',
      ],
    }
  }

  if (workflow === 'synteny_setup') {
    return {
      requiredInputs: [
        'source and target assemblies',
        'alignment or comparative track identifiers',
      ],
      clarificationQuestions: [
        'Which two assemblies should be compared?',
        'Which alignment track should be used for synteny context?',
      ],
      nextActions: [
        {
          stepId: 'ss-1',
          title: 'Inspect loaded assemblies and tracks',
          recommendedTool: 'SessionSnapshot',
          reason:
            'Validate that required assemblies/tracks exist before setup.',
        },
        {
          stepId: 'ss-2',
          title: 'Run compatibility diagnostics',
          recommendedTool: 'ConfigDiagnostic',
          reason: 'Detect assembly mismatch risks before enabling tracks.',
        },
        {
          stepId: 'ss-3',
          title: 'Enable compatible comparative tracks',
          recommendedTool: 'SetTrackVisibility',
          reason: 'Activate only tracks compatible with the active assembly.',
        },
      ],
      completionCriteria: [
        'Both assemblies are identified and available',
        'Comparative track(s) are enabled without mismatch errors',
        'Current view is ready for cross-assembly inspection',
      ],
    }
  }

  return {
    requiredInputs: [
      'variant source or identifier',
      'target assembly and locus context',
    ],
    clarificationQuestions: [
      'Which variant set should be used for inspection?',
      'Should inspection start from a known locus or a variant ID lookup?',
    ],
    nextActions: [
      {
        stepId: 'sv-1',
        title: 'Inspect current session and available tracks',
        recommendedTool: 'SessionSnapshot',
        reason: 'Determine whether variant tracks are already present.',
      },
      {
        stepId: 'sv-2',
        title: 'Run config diagnostics for compatibility',
        recommendedTool: 'ConfigDiagnostic',
        reason: 'Ensure variant tracks match active assembly.',
      },
      {
        stepId: 'sv-3',
        title: 'Navigate to variant locus and enable track set',
        recommendedTool: 'NavigateGenome',
        reason: 'Bootstrap inspector workflow from a concrete locus.',
      },
    ],
    completionCriteria: [
      'Variant locus is resolved to exact coordinates',
      'Relevant variant track(s) are visible in an active view',
      'User has actionable next steps for inspection',
    ],
  }
}

export const WorkflowOrchestratorTool = createTool({
  name: 'WorkflowOrchestrator',
  description:
    'Return deterministic step contracts for high-value JBrowse workflows (feature triage, synteny setup, SV inspector bootstrap). Produces required inputs, clarification prompts, next actions, and completion criteria.',
  schema: z.object({
    workflow: z.enum([
      'feature_triage',
      'synteny_setup',
      'sv_inspector_bootstrap',
    ]),
    phase: z
      .enum(['start', 'diagnose', 'act', 'verify'])
      .optional()
      .default('start'),
  }),
  factory_fn:
    () =>
    async ({
      workflow,
      phase,
      // eslint-disable-next-line @typescript-eslint/require-await
    }): Promise<ToolEnvelope<WorkflowOrchestratorData>> => {
      const contract = getWorkflowContract(workflow, phase)
      return ok(`Prepared workflow contract for ${workflow} (${phase})`, {
        workflow,
        phase,
        ...contract,
      })
    },
})
