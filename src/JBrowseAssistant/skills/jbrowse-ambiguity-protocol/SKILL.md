---
name: jbrowse-ambiguity-protocol
description: Use this skill whenever a user request is underspecified, a tool returns multiple candidates, or required context (assembly, track, region) is missing before a mutating action.
---

# jbrowse-ambiguity-protocol

## Overview

This skill defines exactly when and how the agent must ask the user for clarification rather than guessing or proceeding.

## Decision rules

### Stop and ask when:

1. **FindFeature returns multiple results** (including multiple assembly groups when assembly was omitted) and the user did not provide a gene symbol that unambiguously selects one entry (e.g., same name appears in multiple assemblies or on multiple chromosomes).

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
