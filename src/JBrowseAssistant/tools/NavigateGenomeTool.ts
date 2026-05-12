import { AbstractViewModel } from '@jbrowse/core/util'
import { z } from 'zod'

import { ToolEnvelope, err, needsInput, ok } from './ToolEnvelope'
import { createTool } from './base'
import { getNavigableViews } from './viewCapabilities'

export interface NavigateGenomeData {
  navigations: {
    viewId?: string
    viewType: string
    assembly?: string
    locString: string
    result: 'navigated' | 'skipped' | 'failed'
    reason?: string
  }[]
}

export const NavigateGenomeTool = createTool({
  name: 'NavigateGenome',
  description: 'Navigate one or more linear genome views to a location string',
  schema: z.object({
    locString: z.string().optional(),
    assembly: z.string().optional(),
    viewId: z.string().optional(),
    allLinearGenomeViews: z.boolean().optional().default(false),
  }),
  factory_fn:
    (views: AbstractViewModel[]) =>
    async ({
      locString,
      assembly,
      viewId,
      allLinearGenomeViews,
    }): Promise<ToolEnvelope<NavigateGenomeData>> => {
      if (!locString) {
        return needsInput('locString is required to navigate', {
          navigations: [],
        })
      }
      if (assembly !== undefined && !assembly.trim()) {
        return err('If provided, assembly must not be empty', {
          navigations: [],
        })
      }

      const navigableViews = getNavigableViews(views)

      if (navigableViews.length === 0) {
        return err('No navigable view is open', { navigations: [] }, [
          'Open a view that supports genome navigation (e.g., LinearGenomeView, LinearSyntenyView, DotplotView)',
        ])
      }

      const targets = allLinearGenomeViews
        ? navigableViews
        : [
            (viewId
              ? navigableViews.find(v => v.id === viewId)
              : navigableViews[0]) ?? navigableViews[0],
          ]

      const navigations: NavigateGenomeData['navigations'] = []
      for (const view of targets) {
        const v = view as unknown as {
          assemblyNames?: unknown
          navToLocString?: unknown
        }
        const assemblyName =
          assembly ??
          (Array.isArray(v.assemblyNames)
            ? (v.assemblyNames[0] as string | undefined)
            : undefined)
        if (!assemblyName) {
          navigations.push({
            viewId: view.id,
            viewType: view.type,
            locString,
            result: 'failed',
            reason: 'Assembly not resolved for this view',
          })
          continue
        }
        try {
          const navToLocString = v.navToLocString as
            | ((loc: string, assembly: string) => Promise<void>)
            | undefined
          if (typeof navToLocString !== 'function') {
            navigations.push({
              viewId: view.id,
              viewType: view.type,
              assembly: assemblyName,
              locString,
              result: 'failed',
              reason: 'This view does not expose a navigation method',
            })
            continue
          }
          await navToLocString.call(view, locString, assemblyName)
          navigations.push({
            viewId: view.id,
            viewType: view.type,
            assembly: assemblyName,
            locString,
            result: 'navigated',
          })
        } catch (e) {
          navigations.push({
            viewId: view.id,
            viewType: view.type,
            assembly: assemblyName,
            locString,
            result: 'failed',
            reason: e instanceof Error ? e.message : String(e),
          })
        }
      }

      const failed = navigations.filter(n => n.result === 'failed').length
      if (failed > 0) {
        return err('Navigation completed with failures', { navigations })
      }

      return ok('Navigation complete', { navigations })
    },
})
