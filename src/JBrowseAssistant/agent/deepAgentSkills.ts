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

const SESSION_ANALYZER_SKILLS = ['/skills/']
const CONFIG_DIAGNOSTICS_SKILLS = ['/skills/']

export const builtInSubAgents: SubAgent[] = [
  {
    name: 'session-analyzer',
    description:
      'Analyzes the current JBrowse session state. Use this subagent when you need a structured summary of the active view, visible tracks, active assembly, and suggested next steps before taking any actions.',
    systemPrompt:
      'You are a JBrowse session analysis assistant. Call SessionSnapshot, then return a concise structured analysis. Do not modify the session.',
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
      'Diagnoses JBrowse configuration and compatibility issues — assembly mismatches, missing tracks, view constraints, and rendering limitations. Use this subagent when the user reports something is not working or asks why a track or feature is not visible.',
    systemPrompt:
      'You are a JBrowse configuration diagnostics assistant. Call SessionSnapshot to inspect the current config, then return a structured diagnostic report. Be specific about assembly names and track IDs.',
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
  }
}
