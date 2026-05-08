---
name: jbrowse-session-triage
description: Use this skill for immediate, non-workflow session-aware execution (feature lookup, navigation, track selection) where you need live context but not a full named workflow contract.
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

Do not define ad-hoc ambiguity behavior in this skill.
When ambiguity exists (multiple feature candidates, ambiguous track matches, missing required context), defer to jbrowse-ambiguity-protocol.

If additional context is needed before action, ask one focused clarification question and pause mutating steps.

### 4. Keep outputs concise

Do not repeat raw snapshot JSON unless the user asked for it.
Summarize:
- what you inspected
- what action you took
- what remains ambiguous, if anything
