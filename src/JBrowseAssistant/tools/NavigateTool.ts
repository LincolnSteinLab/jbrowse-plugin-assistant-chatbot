import type {
  AbstractSessionModel,
  AbstractViewModel,
} from '@jbrowse/core/util'
import type { AssemblyManager } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { z } from 'zod'

import { createTool } from './base'

/**
 * Navigate to a locString in an existing LinearGenomeView or open a new one.
 *
 * Factory args: { assemblyManager, views, session, addView }
 *  - assemblyManager: AssemblyManager
 *  - views: AbstractViewModel[] (current session views)
 *  - session: session model (used to add a view if needed)
 *  - addView: optional helper function to add a view (session.addView)
 */
export const NavigateTool = createTool({
  name: 'Navigate',
  description:
    'Navigate a linear genome view to a locstring. If no suitable LGV is open, open one.',
  schema: z.strictObject({
    loc: z.string().describe('Location string, e.g. chr1:100-200 or gene name'),
    assembly: z.string().optional().describe('Optional assembly name'),
    viewId: z.string().optional().describe('Optional existing view id to use'),
  }),
  factory_fn:
    ({
      assemblyManager,
      views,
      session,
      addView,
    }: {
      assemblyManager?: AssemblyManager
      views: AbstractViewModel[]
      session: AbstractSessionModel
      addView?: (
        viewType: string,
        init?: Record<string, unknown>,
      ) => AbstractViewModel
    }) =>
    async ({ loc, assembly, viewId }) => {
      // choose assemblyName: prefer provided, else session first assembly if available
      const assemblyName = assembly ?? session.assemblyNames[0] ?? undefined
      if (assemblyName && assemblyManager) {
        const asm = await assemblyManager.waitForAssembly(assemblyName)
        if (!asm) {
          return {
            result: 'error',
            message: `assembly ${assemblyName} not found`,
          }
        }
      }

      // find suitable LGV
      let view =
        (viewId && views.find(v => v.id === viewId)) ??
        views.find(
          v =>
            v.type === 'LinearGenomeView' &&
            (!assemblyName ||
              (v as LinearGenomeViewModel).assemblyNames?.includes(
                assemblyName,
              )),
        )

      // If none, open a new LinearGenomeView via session.addView or addView helper
      if (!view) {
        const addV =
          addView ?? (session ? session.addView?.bind(session) : undefined)
        if (!addV) {
          return {
            result: 'error',
            message:
              'No addView/session.addView available to open a LinearGenomeView',
          }
        }
        const newId = `assistant_lgv_${Date.now()}`
        view = addV('LinearGenomeView', { id: newId })
        // wait for initialization if view exposes initialized
        if ((view as LinearGenomeViewModel).initialized === false) {
          // attempt to wait until initialized is true
          await new Promise<void>(resolve => {
            const poll = setInterval(() => {
              if ((view as LinearGenomeViewModel).initialized) {
                clearInterval(poll)
                resolve()
              }
            }, 50)
            // timeout safety
            setTimeout(() => {
              clearInterval(poll)
              resolve()
            }, 2000)
          })
        }
      }

      // now navigate using view.navToLocString (LinearGenomeView API)
      if (
        typeof (view as LinearGenomeViewModel).navToLocString === 'function'
      ) {
        await (view as LinearGenomeViewModel).navToLocString(loc, assemblyName)
        return { result: 'success', viewId: view.id ?? null }
      } else {
        return {
          result: 'error',
          message: 'Selected view does not support navToLocString',
        }
      }
    },
})
