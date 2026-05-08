---
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

```
**Actions taken**
- Navigated to hg38 chr17:7,669,609–7,676,594
- Showed track ncbi_refseq_109_hg38
```
