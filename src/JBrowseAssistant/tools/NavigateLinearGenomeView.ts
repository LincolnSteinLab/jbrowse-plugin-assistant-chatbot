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
import { z } from 'zod'

import { createTool, EmptySchema } from './base'

export const ViewsTool = createTool({
  name: 'Views',
  description: 'Display info about all views in the JBrowse session',
  schema: EmptySchema,
  factory_fn:
    (views: AbstractViewModel[]) =>
    // eslint-disable-next-line @typescript-eslint/require-await
    async ({}) =>
      JSON.stringify(views, null, '\t'),
})

export const SearchAndNavigateLGVTool = createTool({
  name: 'SearchAndNavigateLGV',
  description:
    'Search indexed features and navigate to the first result in all linear genome views',
  schema: z.object({
    input: z
      .string()
      .describe(
        'Feature search string, for example a gene name, protein, or transcript ID',
      ),
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
    async ({ input }) => {
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
      return resultStrs.join('\n')
    },
})

export const NavigateLinearGenomeViewTool = createTool({
  name: 'NavigateLinearGenomeView',
  description: 'Moves and zooms a linear genome view to a specific location',
  schema: z.object({
    locString: z
      .string()
      .describe(
        'locstring - e.g. "chr1:1-100", "chr1:1-100 chr2:1-100", "chr 1 100"',
      ),
  }),
  factory_fn:
    (views: AbstractViewModel[]) =>
    async ({ locString }) => {
      const lgviews: LinearGenomeViewModel[] = views.filter(
        view => view.type === 'LinearGenomeView',
      ) as LinearGenomeViewModel[]
      const results: Promise<void>[] = lgviews.map(lgview =>
        lgview.navToLocString(locString, lgview.assemblyNames[0]),
      )
      await Promise.all(results)
    },
})
