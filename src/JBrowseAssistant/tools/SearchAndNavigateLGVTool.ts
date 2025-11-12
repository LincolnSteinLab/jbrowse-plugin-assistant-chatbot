import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
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

const assemblyNotFoundMessage =
  'assembly not found, the LinearGenomeView may not be initialized yet'

interface NavSuccess {
  result: 'success'
  locString: string
  assembly: string
  searchResult?: BaseResult
}

interface NavFailure {
  result: string
  searchResults?: BaseResult[]
}

type NavResult = NavSuccess | NavFailure

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
      if (lgviews.length === 0)
        return { result: 'no Linear Genome Views are open' }
      const resultPromises: Promise<NavResult>[] = lgviews.map(async lgview => {
        let assemblyName: string
        let assembly: Awaited<ReturnType<AssemblyManager['waitForAssembly']>>
        if (lgview.assemblyNames[0]) {
          assemblyName = lgview.assemblyNames[0]
          assembly = await assemblyManager.waitForAssembly(assemblyName)
          if (!assembly) return { result: assemblyNotFoundMessage }
        } else {
          // TODO: handle assembly selection when missing
          assemblyName = 'hg38'
          assembly = await assemblyManager.waitForAssembly(assemblyName)
          if (!assembly) return { result: assemblyNotFoundMessage }
          lgview.setDisplayedRegions(assembly.regions ?? [])
        }
        const allRefs = assembly?.allRefNamesWithLowerCase ?? []
        if (input.split(' ').every(entry => checkRef(entry, allRefs))) {
          await lgview.navToLocString(input, assembly.name)
          return {
            result: 'success',
            locString: input,
            assembly: assembly.name,
          }
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
            return {
              result: 'too many matches',
              searchResults: results,
            }
          } else if (results.length === 1) {
            await navToOption({
              option: results[0],
              model: lgview,
              assemblyName: assembly.name,
            })
            return {
              result: 'success',
              locString: results[0].locString,
              assembly: assembly.name,
              searchResult: results[0],
            }
          } else {
            await lgview.navToLocString(input, assembly.name)
            return {
              result: 'success',
              locString: input,
              assembly: assembly.name,
            }
          }
        }
      })
      const results = await Promise.all(resultPromises)
      return JSON.stringify(results, null, '\t')
    },
})
