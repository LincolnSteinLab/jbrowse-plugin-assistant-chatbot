import { AbstractViewModel } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { z } from 'zod'

import { createTool } from './base'

export const ToggleTracksTool = createTool({
  name: 'ToggleTracks',
  description: 'Show a track in the first linear genome view',
  schema: z.object({
    input: z.string().describe('trackId'),
  }),
  factory_fn:
    (views: AbstractViewModel[]) =>
    // eslint-disable-next-line @typescript-eslint/require-await
    async ({ input }) => {
      const lgviews: LinearGenomeViewModel[] = views.filter(
        view => view.type === 'LinearGenomeView',
      ) as LinearGenomeViewModel[]
      if (lgviews.length > 0) {
        lgviews[0].showTrack(input)
      }
    },
})
