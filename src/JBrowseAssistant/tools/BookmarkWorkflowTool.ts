import { AbstractViewModel, Region } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { z } from 'zod'

import { ToolEnvelope, err, ok } from './ToolEnvelope'
import { createTool } from './base'

export interface BookmarkWorkflowData {
  viewId: string
  viewType: string
  assembly: string
  locations: {
    refName: string
    start: number
    end: number
    locString: string
  }[]
  label?: string
}

function hasDisplayedRegions(
  view: AbstractViewModel,
): view is AbstractViewModel & { displayedRegions: Region[] } {
  return (
    'displayedRegions' in view &&
    Array.isArray((view as { displayedRegions: unknown }).displayedRegions)
  )
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
    (views: AbstractViewModel[]) =>
    // eslint-disable-next-line @typescript-eslint/require-await
    async ({ viewId, label }): Promise<ToolEnvelope<BookmarkWorkflowData>> => {
      const lgviews = views.filter(
        v => v.type === 'LinearGenomeView',
      ) as LinearGenomeViewModel[]

      if (lgviews.length === 0) {
        return err(
          'No LinearGenomeView is open',
          { viewId: '', viewType: '', assembly: '', locations: [] },
          ['Open a LinearGenomeView first using EnsureView'],
        )
      }

      const view =
        (viewId ? lgviews.find(v => v.id === viewId) : lgviews[0]) ?? lgviews[0]

      const assembly = view.assemblyNames?.[0]
      if (!assembly) {
        return err(
          'Could not determine assembly for view',
          { viewId: view.id, viewType: view.type, assembly: '', locations: [] },
          ['Ensure the view has an active assembly'],
        )
      }

      if (!hasDisplayedRegions(view) || view.displayedRegions.length === 0) {
        return err(
          'View has no displayed regions',
          { viewId: view.id, viewType: view.type, assembly, locations: [] },
          ['Navigate to a region first using NavigateGenome'],
        )
      }

      const locations = view.displayedRegions.map(region => ({
        refName: region.refName,
        start: region.start,
        end: region.end,
        locString: `${region.refName}:${(region.start + 1).toLocaleString()}-${region.end.toLocaleString()}`,
      }))

      return ok(
        `Captured ${locations.length} location(s) from view ${view.id}${label ? ` — "${label}"` : ''}`,
        {
          viewId: view.id,
          viewType: view.type,
          assembly,
          locations,
          ...(label !== undefined && { label }),
        },
      )
    },
})
