---
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
