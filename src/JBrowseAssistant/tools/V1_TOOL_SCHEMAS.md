# V1 Tool Contracts for Natural-Language Copilot Workflows

Date: 2026-04-09

This document defines a pragmatic v1 tool set focused on natural-language task execution, not strict command parsing.

## Goals

- Keep tool inputs explicit and deterministic.
- Return compact, JSON-serializable outputs that are easy for the LLM to chain.
- Avoid organism assumptions (no hardcoded assembly defaults).
- Eliminate silent failures by standardizing response envelopes.

## Shared Response Envelope

All v1 tools SHOULD return this shape.

```ts
// Informal TypeScript shape
export type ToolStatus = 'ok' | 'needs_input' | 'error'

export interface ToolEnvelope<TData = unknown> {
  status: ToolStatus
  message: string
  data?: TData
  suggestions?: string[]
}
```

Conventions:

- `ok`: action completed or retrieval succeeded.
- `needs_input`: the tool could continue but needs disambiguation (assembly, feature candidate, view target).
- `error`: hard failure.
- `suggestions`: short follow-up prompts for the assistant to present to the user.

## 1) SessionSnapshot

Purpose: compact state summary for planning and grounding.

### Input schema

```ts
z.object({
  includeTracks: z.boolean().optional().default(true),
  includeRegions: z.boolean().optional().default(true),
})
```

### Output schema

```ts
z.object({
  status: z.enum(['ok', 'needs_input', 'error']),
  message: z.string(),
  data: z
    .object({
      assemblies: z.array(
        z.object({
          name: z.string(),
          refNameCount: z.number().optional(),
        }),
      ),
      views: z.array(
        z.object({
          id: z.string().optional(),
          type: z.string(),
          name: z.string().optional(),
          assemblyNames: z.array(z.string()).optional(),
          displayedRegions: z.array(z.string()).optional(),
          shownTrackIds: z.array(z.string()).optional(),
        }),
      ),
      defaults: z
        .object({
          preferredViewId: z.string().optional(),
          preferredAssembly: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  suggestions: z.array(z.string()).optional(),
})
```

## 2) FindFeature

Purpose: resolve user text (gene/transcript/feature) to candidate locations.

### Input schema

```ts
z.object({
  query: z.string().min(1),
  assembly: z.string().optional(),
  searchType: z.enum(['exact', 'prefix', 'fuzzy']).optional().default('exact'),
  maxResults: z.number().int().positive().max(50).optional().default(10),
  viewId: z.string().optional(),
})
```

### Output schema

```ts
z.object({
  status: z.enum(['ok', 'needs_input', 'error']),
  message: z.string(),
  data: z
    .object({
      assembly: z.string().optional(),
      candidates: z.array(
        z.object({
          id: z.string().optional(),
          label: z.string(),
          locString: z.string(),
          refName: z.string().optional(),
          start: z.number().optional(),
          end: z.number().optional(),
          score: z.number().optional(),
          source: z.string().optional(),
        }),
      ),
    })
    .optional(),
  suggestions: z.array(z.string()).optional(),
})
```

Semantics:

- `needs_input` when assembly or candidate disambiguation is needed.
- `ok` with empty candidates is allowed but should include suggestions.

## 3) NavigateGenome

Purpose: navigate one or more LGVs to a location.

### Input schema

```ts
z.object({
  locString: z.string().optional(),
  candidateIndex: z.number().int().nonnegative().optional(),
  assembly: z.string().optional(),
  viewId: z.string().optional(),
  allLinearGenomeViews: z.boolean().optional().default(false),
})
.refine(v => !!v.locString || v.candidateIndex !== undefined, {
  message: 'Provide locString or candidateIndex',
})
```

### Output schema

```ts
z.object({
  status: z.enum(['ok', 'needs_input', 'error']),
  message: z.string(),
  data: z
    .object({
      navigations: z.array(
        z.object({
          viewId: z.string().optional(),
          viewType: z.string(),
          assembly: z.string().optional(),
          locString: z.string(),
          result: z.enum(['navigated', 'skipped', 'failed']),
          reason: z.string().optional(),
        }),
      ),
    })
    .optional(),
  suggestions: z.array(z.string()).optional(),
})
```

## 4) SetTrackVisibility

Purpose: show/hide tracks using IDs or friendly names.

### Input schema

```ts
z.object({
  show: z.array(z.string()).optional().default([]),
  hide: z.array(z.string()).optional().default([]),
  viewId: z.string().optional(),
  matchMode: z.enum(['id', 'name', 'auto']).optional().default('auto'),
})
.refine(v => v.show.length > 0 || v.hide.length > 0, {
  message: 'Provide at least one track to show or hide',
})
```

### Output schema

```ts
z.object({
  status: z.enum(['ok', 'needs_input', 'error']),
  message: z.string(),
  data: z
    .object({
      viewId: z.string().optional(),
      shown: z.array(z.string()).default([]),
      hidden: z.array(z.string()).default([]),
      unmatched: z.array(z.string()).default([]),
      ambiguous: z
        .array(
          z.object({
            query: z.string(),
            candidates: z.array(z.string()),
          }),
        )
        .default([]),
    })
    .optional(),
  suggestions: z.array(z.string()).optional(),
})
```

## 5) EnsureView

Purpose: reuse or open a view suitable for requested operations.

### Input schema

```ts
z.object({
  viewType: z.string().optional().default('LinearGenomeView'),
  assembly: z.string().optional(),
  locString: z.string().optional(),
  reuseExisting: z.boolean().optional().default(true),
})
```

### Output schema

```ts
z.object({
  status: z.enum(['ok', 'needs_input', 'error']),
  message: z.string(),
  data: z
    .object({
      viewId: z.string().optional(),
      viewType: z.string(),
      created: z.boolean(),
      initialized: z.boolean().optional(),
      assembly: z.string().optional(),
      locString: z.string().optional(),
    })
    .optional(),
  suggestions: z.array(z.string()).optional(),
})
```

## 6) AnswerWithDocs

Purpose: answer how-to/config questions with concise docs grounding.

### Input schema

```ts
z.object({
  question: z.string().min(1),
  maxPages: z.number().int().positive().max(10).optional().default(5),
})
```

### Output schema

```ts
z.object({
  status: z.enum(['ok', 'needs_input', 'error']),
  message: z.string(),
  data: z
    .object({
      snippets: z.array(
        z.object({
          source: z.string(),
          title: z.string().optional(),
          excerpt: z.string(),
        }),
      ),
      retrieval: z.object({
        fromCache: z.boolean().optional(),
        pageCount: z.number().optional(),
      }),
    })
    .optional(),
  suggestions: z.array(z.string()).optional(),
})
```

## 7) RunWorkflow

Purpose: execute a multi-step natural-language task by composing v1 tools.

### Input schema

```ts
z.object({
  task: z.string().min(1),
  dryRun: z.boolean().optional().default(false),
})
```

### Output schema

```ts
z.object({
  status: z.enum(['ok', 'needs_input', 'error']),
  message: z.string(),
  data: z
    .object({
      dryRun: z.boolean(),
      steps: z.array(
        z.object({
          tool: z.string(),
          status: z.enum(['ok', 'needs_input', 'error', 'skipped']),
          message: z.string(),
        }),
      ),
      finalState: z
        .object({
          viewId: z.string().optional(),
          assembly: z.string().optional(),
          locString: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  suggestions: z.array(z.string()).optional(),
})
```

Routing guidance:

- Decompose task into at most 5 steps in v1.
- Prefer read steps first (`SessionSnapshot`, `FindFeature`) then mutation steps (`EnsureView`, `NavigateGenome`, `SetTrackVisibility`).
- If any step returns `needs_input`, stop and surface disambiguation.

## Suggested Mapping to Current Code

- `SessionSnapshot`: replace or supersede `Views` and `JBrowseConfig` broad dumps.
- `FindFeature`: split search from navigation in `SearchAndNavigateLGV`.
- `NavigateGenome`: navigation-only path from `SearchAndNavigateLGV`.
- `SetTrackVisibility`: supersede `ToggleTracks` with show/hide and matching.
- `EnsureView`: evolve `OpenView` with reuse + optional initial context.
- `AnswerWithDocs`: evolve `JBrowseDocumentation` output to include retrieval status and snippets.
- `RunWorkflow`: new orchestration tool that composes the above.

## v1 Non-Goals

- Full command DSL parsing.
- Persistent macro library.
- Cross-view comparative planning.

## Acceptance Criteria

- No silent tool failures.
- No hardcoded assembly fallback values.
- All tool outputs conform to the shared envelope.
- Common prompt works in one turn: "show me BRCA1 in hg38 and display gene and coverage tracks".
