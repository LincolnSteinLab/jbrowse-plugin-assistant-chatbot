import { AbstractViewModel } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'

import { createTool } from './base'

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
