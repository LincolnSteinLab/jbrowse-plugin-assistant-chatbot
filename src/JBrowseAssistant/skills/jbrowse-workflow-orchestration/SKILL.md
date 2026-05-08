---
name: jbrowse-workflow-orchestration
description: Use this skill only when the request maps to a named workflow contract (feature triage, synteny setup, SV inspector bootstrap) and staged coordination is required.
---

# jbrowse-workflow-orchestration

## Overview

This skill teaches the agent to use workflow contracts and bootstrap tools for deterministic multi-step execution.

## Instructions

### 0. Create a plan first for multi-step workflows

For planning behavior (write_todos usage and status lifecycle), follow jbrowse-planning-discipline.
This skill focuses on workflow-specific orchestration only.

### 1. Use WorkflowOrchestrator only for introspection or checklist requests

When a request resembles one of these workflows, use planning + direct workflow tools first.
Call WorkflowOrchestrator only when the user explicitly asks for a step checklist, a dry-run plan, or a phase-by-phase workflow contract:
- feature triage
- synteny setup
- sv inspector bootstrap

When used, treat its nextActions/completionCriteria as advisory diagnostics rather than the single source of truth.

### 2. Pair orchestrator with workflow-specific bootstrap tools

For synteny setup:
- call SyntenySetup with sourceAssembly, targetAssembly, and comparativeTrackQueries
- use resolvedComparativeTrackIds with SetTrackVisibility

For SV inspector bootstrap:
- call SVInspectorBootstrap with locString/assembly and variantTrackQueries
- use resolvedVariantTrackIds with SetTrackVisibility
- if locString exists, navigate with NavigateGenome

### 3. Respect ambiguity protocol

If bootstrap tools report ambiguousTrackQueries or missingTrackQueries, follow jbrowse-ambiguity-protocol directly.

### 4. Keep execution minimal and state-aware

Do not execute all suggested steps blindly.
Use SessionSnapshot to skip already-satisfied steps and apply only required state changes.
