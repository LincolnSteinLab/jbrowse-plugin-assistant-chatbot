---
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

For mutation-reporting details (exact locString values, exact track IDs, assembly naming), follow jbrowse-reproducibility.

This skill focuses on handoff composition and missing-prerequisite guidance.

### 4. Keep the handoff concise

Output should be short and action-oriented:
- current state summary
- concrete step list to reproduce
- unresolved prerequisites, if any
