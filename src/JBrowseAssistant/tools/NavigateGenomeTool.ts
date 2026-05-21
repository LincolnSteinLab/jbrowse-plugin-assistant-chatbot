import { AbstractViewModel } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { z } from 'zod'

import { ToolEnvelope, err, needsInput, ok } from './ToolEnvelope'
import { createTool } from './base'
import {
  getLocStringNavigableViews,
  hasNavigableComparativeRows,
} from './viewCapabilities'

export interface NavigateGenomeData {
  navigations: {
    viewId?: string
    childViewId?: string
    childViewIndex?: number
    viewType: string
    assembly?: string
    locString: string
    result: 'navigated' | 'skipped' | 'failed'
    reason?: string
  }[]
}

export const NavigateGenomeTool = createTool({
  name: 'NavigateGenome',
  description:
    'Navigate one or more locString-navigable views to a location string, including comparative view rows',
  schema: z.object({
    locString: z.string().optional(),
    assembly: z.string().optional(),
    viewId: z.string().optional(),
    comparativeRowIndex: z.number().int().min(0).optional(),
    allLinearGenomeViews: z.boolean().optional().default(false),
  }),
  factory_fn:
    ([views]: [views: AbstractViewModel[]]) =>
    async ({
      locString,
      assembly,
      viewId,
      comparativeRowIndex,
      allLinearGenomeViews,
    }): Promise<ToolEnvelope<NavigateGenomeData>> => {
      if (!locString) {
        return needsInput('locString is required to navigate', {
          navigations: [],
        })
      }
      if (!(assembly?.trim() ?? true)) {
        return err('If provided, assembly must not be empty', {
          navigations: [],
        })
      }

      const dotplotViews = views.filter(view => view.type === 'DotplotView')
      const navigableViews = getLocStringNavigableViews(views)

      if (navigableViews.length === 0) {
        const dotplotHint =
          dotplotViews.length > 0
            ? [
                'DotplotView does not expose locString navigation. Open a LinearGenomeView or LinearSyntenyView to navigate by locString.',
              ]
            : []
        return err('No navigable view is open', { navigations: [] }, [
          'Open a view that supports locString navigation (e.g., LinearGenomeView or LinearSyntenyView).',
          ...dotplotHint,
        ])
      }

      if (viewId) {
        const requestedView = views.find(v => v.id === viewId)
        if (!requestedView) {
          return err('Requested viewId was not found', { navigations: [] }, [
            `Use one of the open view IDs: ${views.map(v => v.id).join(', ')}`,
          ])
        }
        if (requestedView.type === 'DotplotView') {
          return err('DotplotView does not support locString navigation', {
            navigations: [
              {
                viewId: requestedView.id,
                viewType: requestedView.type,
                locString,
                result: 'skipped',
                reason:
                  'DotplotView uses 2D axis coordinates and does not expose navToLocString',
              },
            ],
          })
        }
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
        const v = view as AbstractViewModel & {
          assemblyNames?: unknown
          navToLocString?: unknown
        }

        if (hasNavigableComparativeRows(view)) {
          const rowIndex = comparativeRowIndex ?? 0
          const comparativeRows = (
            view as AbstractViewModel & {
              views?: AbstractViewModel[]
            }
          ).views
          const selectedRow = Array.isArray(comparativeRows)
            ? comparativeRows[rowIndex]
            : undefined
          if (!selectedRow) {
            const maxRowIndex = Array.isArray(comparativeRows)
              ? Math.max(0, comparativeRows.length - 1)
              : 0
            navigations.push({
              viewId: view.id,
              viewType: view.type,
              childViewIndex: rowIndex,
              locString,
              result: 'failed',
              reason: `Comparative row index ${rowIndex} is out of range (available rows: 0-${maxRowIndex})`,
            })
            continue
          }
          if (
            typeof (selectedRow as LinearGenomeViewModel).navToLocString !==
            'function'
          ) {
            navigations.push({
              viewId: view.id,
              viewType: view.type,
              childViewId: selectedRow.id,
              childViewIndex: rowIndex,
              locString,
              result: 'failed',
              reason: `Comparative row ${rowIndex} does not expose locString navigation`,
            })
            continue
          }
          const selectedLinearRow = selectedRow as LinearGenomeViewModel
          const rowAssemblyName =
            assembly ??
            (Array.isArray(selectedLinearRow.assemblyNames)
              ? selectedLinearRow.assemblyNames[0]
              : undefined)
          if (!rowAssemblyName) {
            navigations.push({
              viewId: view.id,
              viewType: view.type,
              childViewId: selectedRow.id,
              childViewIndex: rowIndex,
              locString,
              result: 'failed',
              reason: 'Assembly not resolved for the selected comparative row',
            })
            continue
          }
          try {
            await selectedLinearRow.navToLocString(locString, rowAssemblyName)
            navigations.push({
              viewId: view.id,
              viewType: view.type,
              childViewId: selectedLinearRow.id,
              childViewIndex: rowIndex,
              assembly: rowAssemblyName,
              locString,
              result: 'navigated',
            })
          } catch (e) {
            navigations.push({
              viewId: view.id,
              viewType: view.type,
              childViewId: selectedLinearRow.id,
              childViewIndex: rowIndex,
              assembly: rowAssemblyName,
              locString,
              result: 'failed',
              reason: e instanceof Error ? e.message : String(e),
            })
          }
          continue
        }

        const directView = v as LinearGenomeViewModel
        const assemblyName =
          assembly ??
          (Array.isArray(directView.assemblyNames)
            ? directView.assemblyNames[0]
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
          if (typeof directView.navToLocString !== 'function') {
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
          await directView.navToLocString(locString, assemblyName)
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
