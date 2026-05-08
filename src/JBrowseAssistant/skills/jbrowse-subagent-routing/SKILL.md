---
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
