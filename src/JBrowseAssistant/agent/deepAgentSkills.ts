import { SubAgent } from 'deepagents'
import { z } from 'zod'

interface DeepAgentFileData {
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

const SESSION_ANALYZER_SKILLS = ['/skills-subagents/session-analyzer/']
const CONFIG_DIAGNOSTICS_SKILLS = ['/skills-subagents/config-diagnostics/']

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

export function getBuiltInDeepAgentSkillFiles(): Record<
  string,
  DeepAgentFileData
> {
  return {
    '/skills/jbrowse-session-triage/SKILL.md': createFileData(`---
name: jbrowse-session-triage
description: Use this skill for multi-step JBrowse browsing tasks that require understanding the current session before acting, especially feature lookup, navigation, and track-selection requests.
---

# jbrowse-session-triage

## Overview

This skill helps the agent use the existing JBrowse tools in a safe, minimal, context-aware order.

## Instructions

### 1. Start from the live session

If the request depends on the current browser state, call SessionSnapshot first.

Use the snapshot to determine:
- whether a LinearGenomeView already exists
- which assembly is currently active
- which tracks are already shown
- which exact track IDs are available

### 2. Prefer the smallest correct tool sequence

Use these patterns:
- feature name or identifier -> FindFeature
- genomic location string -> NavigateGenome
- need a view first -> EnsureView, then NavigateGenome
- track changes -> SetTrackVisibility using exact track IDs from SessionSnapshot

### 3. Reduce ambiguity before mutating session state

If FindFeature returns multiple candidates, do not guess. Ask for a precise choice or choose only when the user already provided enough disambiguating context.

If SetTrackVisibility reports ambiguous matches, use exact track IDs from SessionSnapshot.availableTracks.

### 4. Keep outputs concise

Do not repeat raw snapshot JSON unless the user asked for it.
Summarize:
- what you inspected
- what action you took
- what remains ambiguous, if anything
`),
    '/skills/jbrowse-track-resolution/SKILL.md': createFileData(`---
name: jbrowse-track-resolution
description: Use this skill when the task involves showing, hiding, or choosing tracks in JBrowse, especially when track names are ambiguous or assembly compatibility matters.
---

# jbrowse-track-resolution

## Overview

This skill teaches the agent how to reliably choose tracks with the existing SetTrackVisibility tool.

## Instructions

### 1. Prefer exact track IDs over display names

When the user names tracks informally, inspect SessionSnapshot.availableTracks and map the request to exact IDs.

### 2. Respect assembly compatibility

If the task is to show tracks in the current LinearGenomeView, prefer tracks whose assemblyNames overlap the active view assembly.

If there is a mismatch:
- explain the mismatch briefly
- propose the closest compatible alternatives
- avoid claiming a track was shown when the tool reported an assembly mismatch

### 3. Use tool diagnostics as operator feedback

When SetTrackVisibility returns diagnostics such as zoom or rendering constraints, surface them as concrete next actions instead of raw diagnostic dumps.

Examples:
- 'Zoom in further before enabling this alignments track.'
- 'Use the exact track ID instead of the display name because multiple tracks matched.'

### 4. Minimize unnecessary toggles

Do not hide or show tracks speculatively.
Apply only the smallest set of visibility changes needed to satisfy the user request.
`),
    '/skills/jbrowse-config-diagnostics/SKILL.md': createFileData(`---
name: jbrowse-config-diagnostics
description: Use this skill when the user reports something is not working, asks why a track is invisible, or encounters assembly/rendering issues.
---

# jbrowse-config-diagnostics

## Overview

This skill teaches the agent how to diagnose and explain JBrowse configuration and compatibility problems using the available tools.

## Instructions

### 1. Call SessionSnapshot as the first diagnostic step

Before reporting any issue, obtain the session snapshot. It provides:
- Active assembly name and aliases
- All available track IDs, their assemblyNames, and their types
- Current view type and displayed regions

### 2. Diagnose assembly mismatches specifically

A track is incompatible if none of its assemblyNames overlap with the active view assembly (including aliases).

When reporting a mismatch:
- Name the track ID and its declared assemblyNames
- Name the active assembly and its aliases
- Suggest the user add a track whose assemblyNames include the active assembly

### 3. Distinguish rendering constraints from configuration errors

If SetTrackVisibility returns zoom or region constraints, these are runtime rendering limits, not config errors:
- State the constraint clearly (e.g., 'This alignments track requires zooming to below 50 bp/px')
- Suggest the concrete action (navigate to a smaller region, zoom in)

### 4. Propose the next concrete action

Every diagnostic finding should end with one of:
- A specific tool call the agent can make
- A specific UI action the user should take
- A configuration change with the exact field and value

Never leave a diagnostic without a suggested resolution.
`),
    '/skills/jbrowse-ambiguity-protocol/SKILL.md': createFileData(`---
name: jbrowse-ambiguity-protocol
description: Use this skill whenever a user request is underspecified, a tool returns multiple candidates, or required context (assembly, track, region) is missing before a mutating action.
---

# jbrowse-ambiguity-protocol

## Overview

This skill defines exactly when and how the agent must ask the user for clarification rather than guessing or proceeding.

## Decision rules

### Stop and ask when:

1. **FindFeature returns multiple results** and the user did not provide a gene symbol that unambiguously selects one entry (e.g., same name appears in multiple assemblies or on multiple chromosomes).

2. **SetTrackVisibility receives a display name that matches more than one track ID** and the user did not specify assembly context.

3. **NavigateGenome receives a bare region string** (e.g., "chr1") with no coordinates and no visible feature to center on.

4. **The user's intended assembly is unknown** and more than one assembly is loaded in the session.

5. **A tool returns needsInput** — always surface the tool's clarification prompt directly to the user without rephrasing.

### Proceed without asking when:

1. The user's request maps to exactly one tool result and there is no plausible alternative.

2. The session snapshot provides enough context to resolve the ambiguity without guessing (e.g., only one assembly is loaded, or the track name matches exactly one ID).

3. The user has already provided the disambiguating detail in an earlier message within this thread.

## How to ask

When stopping to ask:
- State what you found (e.g., 'I found 3 tracks matching "RNA-seq"')
- List the exact IDs or candidates concisely (use a short numbered or bullet list)
- Ask the single most important clarifying question
- Do not take any mutating action before receiving the answer

## How to proceed after clarification

When the user answers:
- Confirm which candidate you selected
- Complete the original task using the exact ID or value they specified
- Do not ask again for the same information
`),
    '/skills/jbrowse-reproducibility/SKILL.md': createFileData(`---
name: jbrowse-reproducibility
description: Use this skill for every response that modifies the JBrowse session — navigation, track changes, or view creation — to ensure the user can reproduce or share what was done.
---

# jbrowse-reproducibility

## Overview

This skill ensures that every mutating action the agent takes is reported with enough precision that the user (or another agent) can reproduce it exactly.

## Instructions

### 1. Report exact coordinates after navigation

After calling NavigateGenome, include the resolved location in your response:
- Assembly name
- Chromosome / sequence name
- Start and end coordinates (1-based, inclusive)

Example: 'Navigated to hg38 chr17:7,669,609–7,676,594'

### 2. Report exact track IDs after visibility changes

After calling SetTrackVisibility, list:
- The operation (shown / hidden)
- The exact track ID(s) used (not the display name)

Example: 'Showed track ncbi_refseq_109_hg38'

### 3. Record subagent findings that informed the action

If session-analyzer or config-diagnostics was used to inform a subsequent action, briefly note:
- What the subagent found
- How it influenced the chosen action

### 4. Omit reproduction details for read-only operations

If no session state was mutated (e.g., FindFeature with no navigation, SessionSnapshot, diagnostic queries), skip the reproducibility summary.

### 5. Format

Use a short '**Actions taken**' section at the end of responses that mutated session state:

\`\`\`
**Actions taken**
- Navigated to hg38 chr17:7,669,609–7,676,594
- Showed track ncbi_refseq_109_hg38
\`\`\`
`),
    '/skills/jbrowse-planning-discipline/SKILL.md': createFileData(`---
name: jbrowse-planning-discipline
description: Use this skill for any request that requires more than one meaningful step, especially when planning, diagnostics, navigation, and track actions are combined.
---

# jbrowse-planning-discipline

## Overview

This skill enforces harness-native planning behavior so multi-step tasks remain structured and easy to verify.

## Instructions

### 1. Use write_todos for multi-step requests

If the task requires more than one meaningful step, call write_todos before executing action tools.

Include only concrete execution tasks, each with one status:
- pending
- in_progress
- completed

### 2. Keep todo lifecycle accurate

When work starts on a step, update it to in_progress.

When a step is fully done, update it to completed.

Do not leave stale in_progress items after the task has moved on.

### 3. Clarify only after reflecting plan state

If a tool response is ambiguous or needs_input:
- update the relevant step to in_progress
- ask a focused clarification question
- do not mark the step completed until clarification is resolved

### 4. Close with plan-aligned summary

For multi-step tasks, end with a concise summary that reflects completed steps and any still-pending item.
`),
    '/skills/jbrowse-subagent-routing/SKILL.md': createFileData(`---
name: jbrowse-subagent-routing
description: Use this skill to decide when to delegate work to subagents versus handling the request directly in the parent agent.
---

# jbrowse-subagent-routing

## Overview

This skill keeps parent-agent context lean by delegating analysis-heavy tasks to specialized subagents.

## Routing rules

### 1. Delegate to session-analyzer when

- the request needs a compact understanding of current session state before action
- the parent agent needs active assembly, visible tracks, and view status in one structured summary
- the next action is not yet clear without snapshot interpretation

### 2. Delegate to config-diagnostics when

- the user reports that tracks/features are missing, incompatible, or failing to render
- assembly compatibility or track-selection correctness is uncertain
- tool errors suggest configuration mismatch instead of user input ambiguity

### 3. Keep parent agent responsible for final execution

After subagent output is received:
- parent agent chooses the final tool calls
- parent agent performs mutating actions (navigation, visibility changes, view creation)
- parent agent reports final actions taken

### 4. Avoid unnecessary delegation

Do not delegate when:
- the request is single-step and unambiguous
- required context is already available from a recent tool result in the same turn
`),
    '/skills/jbrowse-workflow-orchestration/SKILL.md': createFileData(`---
name: jbrowse-workflow-orchestration
description: Use this skill when a request spans multiple steps or maps to a known workflow (feature triage, synteny setup, SV inspector bootstrap).
---

# jbrowse-workflow-orchestration

## Overview

This skill teaches the agent to use workflow contracts and bootstrap tools for deterministic multi-step execution.

## Instructions

### 0. Create a plan first for multi-step workflows

Before calling workflow tools, create a todo plan with write_todos.
Keep statuses synchronized with actual progress throughout execution.

### 1. Use WorkflowOrchestrator first for known flows

When a request resembles one of these workflows, call WorkflowOrchestrator immediately:
- feature triage
- synteny setup
- sv inspector bootstrap

Use the returned nextActions and completionCriteria as the execution plan.

### 2. Pair orchestrator with workflow-specific bootstrap tools

For synteny setup:
- call SyntenySetup with sourceAssembly, targetAssembly, and comparativeTrackQueries
- use resolvedComparativeTrackIds with SetTrackVisibility

For SV inspector bootstrap:
- call SVInspectorBootstrap with locString/assembly and variantTrackQueries
- use resolvedVariantTrackIds with SetTrackVisibility
- if locString exists, navigate with NavigateGenome

### 3. Respect ambiguity protocol

If bootstrap tools report ambiguousTrackQueries or missingTrackQueries:
- do not guess
- ask for exact track IDs
- continue only after clarification

### 4. Keep execution minimal and state-aware

Do not execute all suggested steps blindly.
Use SessionSnapshot to skip already-satisfied steps and apply only required state changes.
`),
    '/skills/jbrowse-session-sharing/SKILL.md': createFileData(`---
name: jbrowse-session-sharing
description: Use this skill when the user wants to share, reproduce, bookmark, or hand off a JBrowse analysis state.
---

# jbrowse-session-sharing

## Overview

This skill teaches the agent how to produce reproducible handoff instructions and bookmarkable context using session-aware tools.

## Instructions

### 1. Build the share bundle with SessionShareAssistant

For sharing or handoff requests:
- call SessionShareAssistant first
- surface shareable, displayedLocations, shownTrackIds, and operatorInstructions

If shareable is false, explicitly list missingForReproducibility and ask only for the missing pieces.

### 2. Capture investigation trail with BookmarkWorkflow

When a user asks to bookmark or save current context:
- call BookmarkWorkflow
- return the exact assembly and location strings
- include any user-provided label in the response

### 3. Report exact identifiers

Always include:
- exact locString values
- exact track IDs (not only display names)
- assembly name

### 4. Keep the handoff concise

Output should be short and action-oriented:
- current state summary
- concrete step list to reproduce
- unresolved prerequisites, if any
`),
    '/skills-subagents/session-analyzer/SKILL.md': createFileData(`---
name: jbrowse-session-analyzer-subagent
description: Specialized read-only instructions for the session-analyzer subagent.
---

# jbrowse-session-analyzer-subagent

## Mission

Produce a concise, structured snapshot analysis that helps the parent agent decide next actions.

## Rules

- Call SessionSnapshot first.
- Treat this subagent as read-only; do not perform mutating actions.
- Focus on active assembly, view type, visible tracks, and what is missing for the user request.
- Keep suggestions concrete and short so the parent agent can execute immediately.
`),
    '/skills-subagents/config-diagnostics/SKILL.md': createFileData(`---
name: jbrowse-config-diagnostics-subagent
description: Specialized read-only instructions for the config-diagnostics subagent.
---

# jbrowse-config-diagnostics-subagent

## Mission

Return a compact diagnostic report explaining why behavior fails and what the parent agent should do next.

## Rules

- Call SessionSnapshot first.
- Treat this subagent as read-only; do not perform mutating actions.
- Prioritize assembly compatibility, track ID correctness, and rendering constraints.
- Express findings as specific issues with clear remediation suggestions.
`),
  }
}
