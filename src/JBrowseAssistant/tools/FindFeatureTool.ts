import { fetchResults } from '#_/@jbrowse/plugin-linear-genome-view/esm/searchUtils'
import {
  AbstractViewModel,
  AssemblyManager,
  TextSearchManager,
} from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { z } from 'zod'

import { ToolEnvelope, err, needsInput, ok } from './ToolEnvelope'
import { createTool } from './base'

interface FindFeatureData {
  assembly?: string
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
    searchType: z
      .enum(['exact', 'prefix', 'fuzzy'])
      .optional()
      .default('exact'),
    maxResults: z.number().int().positive().max(50).optional().default(10),
    viewId: z.string().optional(),
  }),
  factory_fn:
    ({
      assemblyManager,
      textSearchManager,
      views,
    }: {
      assemblyManager: AssemblyManager
      textSearchManager?: TextSearchManager
      views: AbstractViewModel[]
    }) =>
    async ({
      query,
      assembly,
      searchType,
      maxResults,
      viewId,
    }): Promise<ToolEnvelope<FindFeatureData>> => {
      const lgviews = views.filter(
        view => view.type === 'LinearGenomeView',
      ) as LinearGenomeViewModel[]
      const view =
        (viewId ? lgviews.find(v => v.id === viewId) : lgviews[0]) ?? lgviews[0]

      if (!view) {
        return err('No Linear Genome View is open', { candidates: [] }, [
          'Open a LinearGenomeView and retry feature search',
        ])
      }

      const assemblyName = assembly ?? view.assemblyNames?.[0]
      if (!assemblyName) {
        const assemblyOptions = assemblyManager.assemblies
          .map(a => a.name)
          .filter(Boolean)
        return needsInput(
          'Assembly is required to search features',
          { candidates: [] },
          assemblyOptions.length
            ? [`Specify assembly, for example: ${assemblyOptions[0]}`]
            : ['Specify assembly by name'],
        )
      }

      const resolvedAssembly =
        await assemblyManager.waitForAssembly(assemblyName)
      if (!resolvedAssembly) {
        return err('Assembly could not be resolved', { candidates: [] }, [
          `Check that assembly ${assemblyName} is loaded`,
        ])
      }

      const results = await fetchResults({
        queryString: query,
        searchType: searchType === 'fuzzy' ? 'exact' : searchType,
        searchScope: view.searchScope(resolvedAssembly.name),
        rankSearchResults: view.rankSearchResults.bind(view),
        textSearchManager,
        assembly: resolvedAssembly,
      })

      const candidates: FindFeatureData['candidates'] = []
      for (const result of results.slice(0, maxResults)) {
        if (!result.locString) {
          continue
        }
        candidates.push({
          label: result.label,
          locString: result.locString,
          score: result.score,
        })
      }

      if (!candidates.length) {
        return ok(
          'No feature matches found',
          {
            assembly: resolvedAssembly.name,
            candidates: [],
          },
          ['Try a different identifier or a coordinate range'],
        )
      }

      return ok('Feature candidates retrieved', {
        assembly: resolvedAssembly.name,
        candidates,
      })
    },
})
