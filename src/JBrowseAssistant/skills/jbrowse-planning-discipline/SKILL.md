---
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
