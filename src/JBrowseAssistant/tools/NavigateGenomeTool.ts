import { AbstractViewModel } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { z } from 'zod'

import { ToolEnvelope, err, needsInput, ok } from './ToolEnvelope'
import { createTool } from './base'

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

      const lgviews = views.filter(
        view => view.type === 'LinearGenomeView',
      ) as LinearGenomeViewModel[]

      if (lgviews.length === 0) {
        return err('No Linear Genome View is open', { navigations: [] }, [
          'Open or ensure a LinearGenomeView first',
        ])
      }

      const targets = allLinearGenomeViews
        ? lgviews
        : [
            (viewId ? lgviews.find(v => v.id === viewId) : lgviews[0]) ??
              lgviews[0],
          ]

      const navigations: NavigateGenomeData['navigations'] = []
      for (const view of targets) {
        const assemblyName = assembly ?? view.assemblyNames?.[0]
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
          await view.navToLocString(locString, assemblyName)
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
            reason: e instanceof Error ? e.message : 'Unknown navigation error',
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
