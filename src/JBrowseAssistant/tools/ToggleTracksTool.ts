import {
  AbstractViewModel,
  AssemblyManager,
  TextSearchManager,
} from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'

import { createTool } from './base'

export const ToggleTracksTool = createTool(
  'Toggle tracks',
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
      name: 'ToggleTracks',
      description,
      schema: z.object({
        input: z.string().describe('trackId'),
      }),
      func: async ({ input }) => {
        const lgviews: LinearGenomeViewModel[] = views.filter(
          view => view.type === 'LinearGenomeView',
        ) as LinearGenomeViewModel[]
        lgviews[0].showTrack(input)
        return input
      },
    }),
)
