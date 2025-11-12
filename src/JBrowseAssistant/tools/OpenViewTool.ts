import { ViewType } from '@jbrowse/core/pluggableElementTypes'
import { AbstractViewModel, when } from '@jbrowse/core/util'
import { z } from 'zod'

import { createTool } from './base'

export const OpenViewTool = createTool({
  name: 'OpenView',
  description: 'Open a new view in JBrowse',
  schema: z.object({
    viewType: z.string().describe('Type of view to open'),
  }),
  factory_fn:
    ({
      addView,
      viewTypes,
    }: {
      addView: (viewType: string) => AbstractViewModel
      viewTypes: ViewType[]
    }) =>
    async ({ viewType }) => {
      const viewTypeNames = viewTypes.map(vt => vt.name)
      if (!viewTypeNames.includes(viewType)) {
        return {
          result: 'not found',
          availableViewTypes: viewTypeNames,
        }
      }
      const newView = addView(viewType)
      if ((newView as object).hasOwnProperty('initialized')) {
        await when(
          () =>
            (newView as AbstractViewModel & { initialized: boolean })
              .initialized,
        )
        return {
          result: 'success',
          view: newView,
        }
      } else {
        console.error('View does not have initialized property')
        return {
          result: 'success',
          view: newView,
        }
      }
    },
})
