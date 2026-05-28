import type { SearchType } from '@jbrowse/core/data_adapters/BaseAdapter'
import { AssemblyManager, TextSearchManager } from '@jbrowse/core/util'
import { z } from 'zod'

import { ToolEnvelope, err, needsInput, ok } from './ToolEnvelope'
import { createTool, withTimeout } from './base'

export interface FindFeatureData {
  assembly?: string
  assemblyGroups?: {
    assembly: string
    candidates: {
      label: string
      locString: string
      score?: number
      source?: string
    }[]
  }[]
  candidates: {
    label: string
    locString: string
    score?: number
    source?: string
  }[]
}

export const FindFeatureTool = createTool({
  name: 'FindFeature',
  description:
    'Search indexed features and return ranked candidate locations without navigating',
  schema: z.object({
    query: z.string().min(1),
    assembly: z.string().optional(),
    tracks: z.array(z.string().min(1)).optional(),
    searchType: z.enum(['full', 'prefix', 'exact']).optional().default('exact'),
    maxResults: z.number().int().positive().max(50).optional().default(10),
  }),
  factory_fn:
    ([assemblyManager, textSearchManager]: [
      assemblyManager: AssemblyManager,
      textSearchManager: TextSearchManager | undefined,
    ]) =>
    async ({
      query,
      assembly,
      tracks,
      searchType,
      maxResults,
    }): Promise<ToolEnvelope<FindFeatureData>> => {
      const normalizedQuery = query.trim()
      if (!normalizedQuery) {
        return err('Query must contain at least one non-whitespace character', {
          candidates: [],
        })
      }

      const normalizedSearchType: SearchType = searchType
      const normalizedTracks = tracks
        ?.map(track => track.trim())
        .filter(track => track.length > 0)

      const searchAssembly = async (assemblyName: string) => {
        const resolvedAssembly = await withTimeout(
          assemblyManager.waitForAssembly(assemblyName),
          10_000,
        )
        if (!resolvedAssembly) {
          return undefined
        }

        const textResults =
          (await textSearchManager?.search(
            {
              queryString: normalizedQuery,
              searchType: normalizedSearchType,
            },
            {
              assemblyName: resolvedAssembly.name,
              includeAggregateIndexes: true,
              tracks: normalizedTracks?.length ? normalizedTracks : undefined,
            },
            results => results,
          )) ?? []

        const refResults =
          resolvedAssembly.allRefNames
            ?.filter(ref =>
              normalizedSearchType === 'exact'
                ? ref.toLowerCase() === normalizedQuery.toLowerCase()
                : normalizedSearchType === 'prefix'
                  ? ref.toLowerCase().startsWith(normalizedQuery.toLowerCase())
                  : ref.toLowerCase().includes(normalizedQuery.toLowerCase()),
            )
            .slice(0, 10)
            .map(ref => ({
              label: ref,
              locString: ref,
            })) ?? []

        const candidates: FindFeatureData['candidates'] = []
        const dedupe = new Set<string>()

        for (const result of textResults) {
          if (!result.locString) {
            continue
          }
          const key = `${result.label}::${result.locString}`
          if (dedupe.has(key)) {
            continue
          }
          dedupe.add(key)
          candidates.push({
            label: result.label,
            locString: result.locString,
            score: result.score,
          })
          if (candidates.length >= maxResults) {
            break
          }
        }

        if (candidates.length < maxResults) {
          for (const result of refResults) {
            const key = `${result.label}::${result.locString}`
            if (dedupe.has(key)) {
              continue
            }
            dedupe.add(key)
            candidates.push(result)
            if (candidates.length >= maxResults) {
              break
            }
          }
        }

        return {
          assembly: resolvedAssembly.name,
          candidates,
        }
      }

      if (assembly) {
        let result
        try {
          result = await searchAssembly(assembly)
        } catch {
          return err(
            `Assembly lookup timed out for ${assembly}`,
            { candidates: [] },
            ['Verify assembly loading has completed and try again'],
          )
        }

        if (!result) {
          return err('Assembly could not be resolved', { candidates: [] }, [
            `Check that assembly ${assembly} is loaded`,
          ])
        }

        if (!result.candidates.length) {
          return ok(
            'No feature matches found',
            {
              assembly: result.assembly,
              candidates: [],
            },
            ['Try a different identifier or a coordinate range'],
          )
        }

        return ok('Feature candidates retrieved', {
          assembly: result.assembly,
          candidates: result.candidates,
        })
      }

      const assemblyNames = assemblyManager.assemblies
        .map(a => a.name)
        .filter((a): a is string => !!a)

      if (!assemblyNames.length) {
        return needsInput(
          'No assemblies are available to search',
          { candidates: [], assemblyGroups: [] },
          ['Load an assembly, or specify an assembly name and retry'],
        )
      }

      const groups: NonNullable<FindFeatureData['assemblyGroups']> = []
      for (const assemblyName of assemblyNames) {
        try {
          const result = await searchAssembly(assemblyName)
          if (result?.candidates.length) {
            groups.push(result)
          }
        } catch {
          // Skip timed-out assemblies in grouped mode so other assemblies can still return.
          continue
        }
      }

      if (!groups.length) {
        return ok(
          'No feature matches found in any loaded assembly',
          {
            candidates: [],
            assemblyGroups: [],
          },
          ['Try a different identifier or specify an assembly explicitly'],
        )
      }

      return ok('Feature candidates retrieved across assemblies', {
        candidates: [],
        assemblyGroups: groups,
      })
    },
})
