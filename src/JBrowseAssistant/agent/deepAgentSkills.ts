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
  }
}
