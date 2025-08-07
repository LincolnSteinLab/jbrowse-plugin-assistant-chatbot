import { AbstractViewModel } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'

import { BaseTool } from './BaseTool'

const description =
  'Moves and zooms a linear genome view to a specific location'

const NavToLocSchema = z.object({
  locString: z
    .string()
    .describe(
      'locstring - e.g. "chr1:1-100", "chr1:1-100 chr2:1-100", "chr 1 100"',
    ),
  assemblyName: z
    .string()
    .optional()
    .describe('Optional assembly name to use when navigating'),
})

function getNavigateLGVTool(views: AbstractViewModel[]) {
  return new DynamicStructuredTool({
    name: 'NavigateLinearGenomeView',
    description,
    schema: NavToLocSchema,
    func: async ({ locString, assemblyName }) => {
      console.log(locString, assemblyName)
      const lgviews: LinearGenomeViewModel[] = views.filter(
        view => view.type === 'LinearGenomeView',
      ) as LinearGenomeViewModel[]
      const results: Promise<void>[] = lgviews.map(lgview =>
        lgview.navToLocString(locString, assemblyName),
      )
      await Promise.all(results)
    },
  })
}

export class NavigateLinearGenomeViewTool extends BaseTool<
  ReturnType<typeof getNavigateLGVTool>
> {
  description = description

  constructor(views: AbstractViewModel[]) {
    super()
    this.lc_tool = getNavigateLGVTool(views)
  }
}
