import {
  AbstractViewModel,
  AssemblyManager,
  TextSearchManager,
} from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import {
  checkRef,
  fetchResults,
  navToOption,
} from '@jbrowse/plugin-linear-genome-view/dist/searchUtils'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'

import { createTool, EmptySchema } from './base'

export const ViewsTool = createTool(
  'Display info about all views in the JBrowse session',
  (description, views: AbstractViewModel[]) =>
    new DynamicStructuredTool({
      name: 'Views',
      description,
      schema: EmptySchema,
      // eslint-disable-next-line @typescript-eslint/require-await
      func: async ({}) => JSON.stringify(views, null, '\t'),
    }),
)

export const SearchAndNavigateLGVTool = createTool(
  'Search indexed features, navigate to the first result, and return the results',
  (
    description,
    {
      assemblyManager,
      textSearchManager,
      views,
    }: {
      assemblyManager: AssemblyManager
      textSearchManager?: TextSearchManager
      views: AbstractViewModel[]
    },
  ) =>
    new DynamicStructuredTool({
      name: 'SearchAndNavigateLGV',
      description,
      schema: z.object({
        input: z
          .string()
          .describe(
            'Feature search string, for example a gene name, protein, or transcript ID',
          ),
      }),
      func: async ({ input }) => {
        console.log(input)
        const lgviews: LinearGenomeViewModel[] = views.filter(
          view => view.type === 'LinearGenomeView',
        ) as LinearGenomeViewModel[]
        const results: Promise<string | null>[] = lgviews.map(async lgview => {
          const assembly = await assemblyManager.waitForAssembly(
            lgview.assemblyNames[0],
          )
          if (!assembly) {
            return null
          }
          const allRefs = assembly?.allRefNamesWithLowerCase ?? []
          if (input.split(' ').every(entry => checkRef(entry, allRefs))) {
            await lgview.navToLocString(input, assembly.name)
          } else {
            const searchScope = lgview.searchScope(assembly.name)
            const results = await fetchResults({
              queryString: input,
              searchType: 'exact',
              searchScope,
              rankSearchResults: lgview.rankSearchResults.bind(lgview),
              textSearchManager,
              assembly,
            })
            if (results.length > 1) {
              return JSON.stringify(results, null, '\t')
            } else if (results.length === 1) {
              await navToOption({
                option: results[0],
                model: lgview,
                assemblyName: assembly.name,
              })
            } else {
              await lgview.navToLocString(input, assembly.name)
            }
          }
          return null
        })
        const resultStrs = (await Promise.all(results)).filter(r => r !== null)
        console.log(resultStrs)
        return resultStrs.join('\n')
      },
    }),
)

export const NavigateLinearGenomeViewTool = createTool(
  'Moves and zooms a linear genome view to a specific location',
  (description, views: AbstractViewModel[]) =>
    new DynamicStructuredTool({
      name: 'NavigateLinearGenomeView',
      description,
      schema: z.object({
        locString: z
          .string()
          .describe(
            'locstring - e.g. "chr1:1-100", "chr1:1-100 chr2:1-100", "chr 1 100"',
          ),
      }),
      func: async ({ locString }) => {
        console.log(locString)
        const lgviews: LinearGenomeViewModel[] = views.filter(
          view => view.type === 'LinearGenomeView',
        ) as LinearGenomeViewModel[]
        const results: Promise<void>[] = lgviews.map(lgview =>
          lgview.navToLocString(locString, lgview.assemblyNames[0]),
        )
        await Promise.all(results)
      },
    }),
)
