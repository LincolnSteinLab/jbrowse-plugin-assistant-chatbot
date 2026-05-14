import {
  AbstractViewModel,
  assembleLocString,
  Region,
} from '@jbrowse/core/util'
import { z } from 'zod'

import { ToolEnvelope, err, ok } from './ToolEnvelope'
import { createTool } from './base'
import { getLinearGenomeViews, selectOrFirst } from './bookmarkState'

export interface BookmarkWorkflowData {
  viewId: string
  viewType: string
  locations: (Region & { locString: string })[]
  label?: string
}

export const BookmarkWorkflowTool = createTool({
  name: 'BookmarkWorkflow',
  description:
    'Capture the current navigation state of a linear genome view as a reproducible location record. Returns the assembly, chromosome, and coordinates of the currently displayed region(s) so the user can share or reproduce the view.',
  mcp: false,
  schema: z.object({
    viewId: z
      .string()
      .optional()
      .describe(
        'ID of the LinearGenomeView to capture. Defaults to the first open view.',
      ),
    label: z
      .string()
      .optional()
      .describe('Optional label to attach to this bookmark.'),
  }),
  factory_fn:
    ([views]: [views: AbstractViewModel[]]) =>
    // eslint-disable-next-line @typescript-eslint/require-await
    async ({ viewId, label }): Promise<ToolEnvelope<BookmarkWorkflowData>> => {
      const lgviews = getLinearGenomeViews(views)

      if (lgviews.length === 0) {
        return err(
          'No LinearGenomeView is open',
          { viewId: '', viewType: '', locations: [] },
          ['Open a LinearGenomeView first using EnsureView'],
        )
      }

      const view = selectOrFirst(lgviews, { id: viewId })

      if (!view) {
        return err(
          'Could not find view with specified ID',
          { viewId: viewId ?? '', viewType: '', locations: [] },
          ['Ensure the view ID is correct and the view is open'],
        )
      }

      if (view.displayedRegions.length === 0) {
        return err(
          'View has no displayed regions',
          { viewId: view.id, viewType: view.type, locations: [] },
          ['Navigate to a region first using NavigateGenome'],
        )
      }

      return ok(
        `Captured ${view.displayedRegions.length} location(s) from view ${view.id}${label ? ` — "${label}"` : ''}`,
        {
          viewId: view.id,
          viewType: view.type,
          locations: view.displayedRegions.map(region => ({
            ...region,
            locString: assembleLocString(region),
          })),
          ...(label !== undefined && { label }),
        },
      )
    },
})
