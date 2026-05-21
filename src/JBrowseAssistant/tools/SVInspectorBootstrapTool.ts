import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { BaseTrackModel } from '@jbrowse/core/pluggableElementTypes'
import { getConfAssemblyNames } from '@jbrowse/core/util'
import { z } from 'zod'

import { ToolEnvelope, err, ok } from './ToolEnvelope'
import { createTool } from './base'

export interface SVInspectorBootstrapData {
  assembly?: string
  targetLocString?: string
  resolvedVariantTrackIds: string[]
  ambiguousTrackQueries: {
    query: string
    candidates: string[]
  }[]
  missingTrackQueries: string[]
  nextActions: string[]
}

function includesInsensitive(haystack: string, needle: string) {
  return haystack.trim().toLowerCase().includes(needle.trim().toLowerCase())
}

function looksLikeLocString(value: string) {
  return /^[^:\s]+:\d+[\d,]*-\d+[\d,]*$/.test(value.trim())
}

export const SVInspectorBootstrapTool = createTool({
  name: 'SVInspectorBootstrap',
  description:
    'Bootstrap structural-variant inspection by validating locus/assembly context and resolving variant track IDs. Returns actionable next steps for navigation and track activation.',
  mcp: false,
  schema: z.object({
    assembly: z.string().optional(),
    locString: z.string().optional(),
    variantTrackQueries: z.array(z.string()).optional().default([]),
  }),
  factory_fn:
    ([allTracks]: [allTracks: (AnyConfigurationModel & BaseTrackModel)[]]) =>
    async ({
      assembly,
      locString,
      variantTrackQueries,
      // eslint-disable-next-line @typescript-eslint/require-await
    }): Promise<ToolEnvelope<SVInspectorBootstrapData>> => {
      const targetLocString = locString?.trim()
      if (targetLocString && !looksLikeLocString(targetLocString)) {
        return err('locString must be in ref:start-end format', {
          assembly,
          targetLocString,
          resolvedVariantTrackIds: [],
          ambiguousTrackQueries: [],
          missingTrackQueries: variantTrackQueries,
          nextActions: [
            'Provide location as ref:start-end (e.g., chr1:100000-120000).',
          ],
        })
      }

      const resolvedVariantTrackIds: string[] = []
      const ambiguousTrackQueries: SVInspectorBootstrapData['ambiguousTrackQueries'] =
        []
      const missingTrackQueries: string[] = []

      for (const query of variantTrackQueries) {
        const matches = allTracks.filter(
          track =>
            includesInsensitive(track.trackId, query) ||
            includesInsensitive(track.name as string, query),
        )

        if (matches.length === 0) {
          missingTrackQueries.push(query)
          continue
        }

        if (matches.length > 1) {
          ambiguousTrackQueries.push({
            query,
            candidates: matches.map(match => match.trackId),
          })
          continue
        }

        const [match] = matches
        const matchAssemblyNames = getConfAssemblyNames(match)
        if (
          assembly &&
          matchAssemblyNames.length > 0 &&
          !matchAssemblyNames.includes(assembly)
        ) {
          ambiguousTrackQueries.push({
            query,
            candidates: [
              `${match.trackId} (assembly mismatch: ${matchAssemblyNames.join(', ')})`,
            ],
          })
          continue
        }

        resolvedVariantTrackIds.push(match.trackId)
      }

      const nextActions: string[] = []
      if (targetLocString) {
        nextActions.push(
          `Navigate with NavigateGenome using locString ${targetLocString}${assembly ? ` and assembly ${assembly}` : ''}.`,
        )
      } else {
        nextActions.push(
          'Resolve a target locus (locString) before launching SV inspection steps.',
        )
      }

      if (resolvedVariantTrackIds.length > 0) {
        nextActions.push(
          `Enable variant track IDs with SetTrackVisibility: ${resolvedVariantTrackIds.join(', ')}.`,
        )
      }

      if (ambiguousTrackQueries.length > 0) {
        nextActions.push(
          'Ask the user to pick exact variant track IDs from the ambiguous candidates.',
        )
      }

      if (missingTrackQueries.length > 0) {
        nextActions.push(
          `Variant track queries not found: ${missingTrackQueries.join(', ')}. Use SessionSnapshot.availableTracks to refine selection.`,
        )
      }

      nextActions.push(
        'Use WorkflowOrchestrator with sv_inspector_bootstrap for full staged guidance.',
      )

      return ok('Prepared SV inspector bootstrap analysis', {
        assembly,
        targetLocString,
        resolvedVariantTrackIds,
        ambiguousTrackQueries,
        missingTrackQueries,
        nextActions,
      })
    },
})
