---
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
