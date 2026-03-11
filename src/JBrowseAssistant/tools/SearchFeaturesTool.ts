import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import { SearchScope } from '@jbrowse/core/TextSearch/TextSearchManager'
import type { TextSearchManager } from '@jbrowse/core/util'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import { z } from 'zod'

import { createTool } from './base'

/**
 * Run a text search using TextSearchManager and return a compact list of results.
 *
 * Factory args: { textSearchManager, assemblyManager, session }
 */
export const SearchFeaturesTool = createTool({
  name: 'SearchFeatures',
  description:
    'Search names/indices using the session TextSearchManager and return structured results (label, location, trackId)',
  schema: z.strictObject({
    query: z.string().describe('Search query'),
    assembly: z
      .string()
      .optional()
      .describe('Optional assembly to restrict search'),
    maxResults: z.number().optional(),
  }),
  factory_fn:
    ({
      textSearchManager,
      session,
    }: {
      textSearchManager?: TextSearchManager
      session?: IAnyStateTreeNode
    }) =>
    async ({ query, assembly, maxResults = 20 }) => {
      if (!textSearchManager) {
        return { result: 'error', message: 'No textSearchManager available' }
      }

      const assemblyName = assembly ?? session?.assemblyNames?.[0]

      const searchScope: SearchScope = {
        assemblyName,
        includeAggregateIndexes: true,
      }

      // TextSearchManager.search accepts legacy args, adapt to modern API if needed
      // Use search2 if available
      let results: BaseResult[] = []
      if (typeof textSearchManager.search2 === 'function') {
        // modern API: args wrapper
        const args = { queryString: query }
        results = await textSearchManager.search2({
          args,
          searchScope,
          rankFn: r => r,
        })
      } else if (typeof textSearchManager.search === 'function') {
        // legacy
        results = await textSearchManager.search(
          { queryString: query },
          searchScope,
          r => r,
        )
      } else {
        return {
          result: 'error',
          message: 'TextSearchManager has no search API',
        }
      }

      // compact the result objects to label/location/trackId
      const compact = (results || []).slice(0, maxResults).map(r => ({
        id: r.getId(),
        label: r.label,
        locString: r.locString,
        trackId: r.trackId,
        raw: r,
      }))

      return { result: 'success', hits: compact }
    },
})
