import { ViewType } from '@jbrowse/core/pluggableElementTypes'
import { AbstractViewModel, when } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { z } from 'zod'

import { ToolEnvelope, err, ok } from './ToolEnvelope'
import { createTool } from './base'

interface EnsureViewData {
  viewId?: string
  viewType: string
  created: boolean
  initialized?: boolean
  assembly?: string
  locString?: string
}

function hasInitialized(
  view: AbstractViewModel,
): view is AbstractViewModel & { initialized: boolean } {
  return 'initialized' in view
}

export const EnsureViewTool = createTool({
  name: 'EnsureView',
  description:
    'Reuse an existing view or open a new one, optionally initializing to assembly/location context',
  schema: z.object({
    viewType: z.string().optional().default('LinearGenomeView'),
    assembly: z.string().optional(),
    locString: z.string().optional(),
    reuseExisting: z.boolean().optional().default(true),
  }),
  factory_fn:
    ({
      addView,
      viewTypes,
      views,
    }: {
      addView: (viewType: string) => AbstractViewModel
      viewTypes: ViewType[]
      views: AbstractViewModel[]
    }) =>
    async ({
      viewType,
      assembly,
      locString,
      reuseExisting,
    }): Promise<ToolEnvelope<EnsureViewData>> => {
      const viewTypeNames = viewTypes.map(vt => vt.name)
      if (!viewTypeNames.includes(viewType)) {
        return err('Requested view type is not available', {
          viewType,
          created: false,
        })
      }

      let view = reuseExisting
        ? views.find(v => v.type === viewType)
        : undefined
      let created = false

      if (!view) {
        view = addView(viewType)
        created = true
      }

      if (hasInitialized(view) && view.initialized === false) {
        await when(() => view && view.initialized === true)
      }

      if (locString && view.type === 'LinearGenomeView') {
        const lgv = view as LinearGenomeViewModel
        const assemblyName = assembly ?? lgv?.assemblyNames?.[0]
        if (assemblyName) {
          await lgv.navToLocString(locString, assemblyName)
        }
      }

      return ok(created ? 'Created new view' : 'Reused existing view', {
        viewId: view.id,
        viewType,
        created,
        initialized: hasInitialized(view) ? view.initialized : undefined,
        assembly,
        locString,
      })
    },
})
