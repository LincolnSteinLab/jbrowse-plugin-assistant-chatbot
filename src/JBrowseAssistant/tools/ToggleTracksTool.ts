import { AbstractViewModel } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { z } from 'zod'

import { createTool } from './base'

export const ToggleTracksTool = createTool({
  name: 'ToggleTracks',
  description:
    'Show/hide/toggle a track in a specified linear genome view (or first LGV if not specified)',
  schema: z.object({
    trackId: z.string().describe('trackId'),
    action: z
      .enum(['show', 'hide', 'toggle'])
      .default('show')
      .describe('Action to perform on the track'),
    viewId: z
      .string()
      .optional()
      .describe('Optional view id to apply the action to'),
  }),
  factory_fn:
    (views: AbstractViewModel[]) =>
    async ({
      trackId,
      action = 'show',
      viewId,
      // eslint-disable-next-line @typescript-eslint/require-await
    }) => {
      const lgviews: LinearGenomeViewModel[] = views.filter(
        view => view.type === 'LinearGenomeView',
      ) as LinearGenomeViewModel[]
      if (lgviews.length === 0) {
        return { result: 'error', message: 'no Linear Genome Views are open' }
      }
      let targetView: LinearGenomeViewModel | undefined
      if (viewId) {
        targetView = lgviews.find(v => v.id === viewId)
        if (!targetView) {
          return { result: 'error', message: `viewId ${viewId} not found` }
        }
      } else {
        targetView = lgviews[0]
      }

      if (action === 'show') {
        targetView.showTrack(trackId)
        return {
          result: 'success',
          action: 'show',
          trackId,
          viewId: targetView.id ?? null,
        }
      } else if (action === 'hide') {
        targetView.hideTrack(trackId)
        return {
          result: 'success',
          action: 'hide',
          trackId,
          viewId: targetView.id ?? null,
        }
      } else if (action === 'toggle') {
        targetView.toggleTrack(trackId)
        return {
          result: 'success',
          action: 'toggle',
          trackId,
          viewId: targetView.id ?? null,
        }
      } else {
        return { result: 'error', message: `invalid action` }
      }
    },
})
