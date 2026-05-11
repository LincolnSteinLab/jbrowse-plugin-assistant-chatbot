import { ViewType } from '@jbrowse/core/pluggableElementTypes'
import { AbstractViewModel, when } from '@jbrowse/core/util'
import { z } from 'zod'

import { ToolEnvelope, err, ok } from './ToolEnvelope'
import { createTool, withTimeout } from './base'
import { getPreferredViewType, isNavigableView } from './viewCapabilities'

export interface EnsureViewData {
  viewId?: string
  viewType: string
  created: boolean
  assembly?: string
  locString?: string
}

function getViewLifecycleState(view: AbstractViewModel): {
  showLoading?: boolean
  initPresent?: boolean
  error?: unknown
} {
  const v = view as {
    showLoading?: unknown
    init?: unknown
    error?: unknown
  }

  return {
    showLoading: typeof v.showLoading === 'boolean' ? v.showLoading : undefined,
    initPresent: v.init !== undefined,
    error: v.error,
  }
}

function isTransitioningInitialization(view: AbstractViewModel): boolean {
  const state = getViewLifecycleState(view)

  // Prefer explicit loading state when available.
  if (state.showLoading !== undefined) {
    return state.showLoading
  }

  // Fallback for models that expose init without showLoading.
  return !!state.initPresent
}

export const EnsureViewTool = createTool({
  name: 'EnsureView',
  description:
    'Reuse an existing view or open a new one, optionally initializing to assembly/location context. Can suggest appropriate view type based on task requirements.',
  schema: z.object({
    viewType: z.string().optional(),
    preferredCapability: z
      .enum([
        'multi-assembly',
        'comparative',
        'linear',
        'circular',
        'feature',
        'any',
      ])
      .optional()
      .describe(
        'Desired capability: multi-assembly for synteny, linear for navigation, etc. Tool suggests best available type.',
      ),
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
      preferredCapability,
      assembly,
      locString,
      reuseExisting,
    }): Promise<ToolEnvelope<EnsureViewData>> => {
      const viewTypeNames = viewTypes.map(vt => vt.name)

      // Determine which viewType to use
      let selectedViewType = viewType
      if (!selectedViewType && preferredCapability) {
        const suggested = getPreferredViewType(
          preferredCapability,
          viewTypeNames,
        )
        if (suggested) {
          selectedViewType = suggested
        }
      }
      selectedViewType ??= 'LinearGenomeView'

      if (!viewTypeNames.includes(selectedViewType)) {
        return err('Requested view type is not available', {
          viewType: selectedViewType,
          created: false,
        })
      }

      let view = reuseExisting
        ? views.find(v => v.type === selectedViewType)
        : undefined
      let created = false

      if (!view) {
        view = addView(selectedViewType)
        created = true
      }

      let initializationTimedOut = false
      if (isTransitioningInitialization(view)) {
        try {
          await withTimeout(
            when(() => {
              const state = getViewLifecycleState(view)
              return !!state.error || !isTransitioningInitialization(view)
            }),
            10_000,
          )
        } catch {
          initializationTimedOut = true
        }
      }

      const lifecycle = getViewLifecycleState(view)
      if (lifecycle.error) {
        return err('View initialization failed', {
          viewId: view.id,
          viewType: selectedViewType,
          created,
          assembly,
          locString,
        })
      }

      if (initializationTimedOut && locString) {
        return err(
          'View is still initializing; retry navigation shortly',
          {
            viewId: view.id,
            viewType: selectedViewType,
            created,
            assembly,
            locString,
          },
          [
            'Retry EnsureView with the same locString after the view finishes loading.',
          ],
        )
      }

      // Try to navigate if locString provided and view is navigable
      if (locString && isNavigableView(view)) {
        const v = view as unknown as {
          navToLocString?: unknown
          assemblyNames?: unknown
        }
        const navToLocString = v.navToLocString as
          | ((loc: string, assembly: string) => Promise<void>)
          | undefined
        if (typeof navToLocString === 'function') {
          const assemblyName =
            assembly ??
            (v.assemblyNames && Array.isArray(v.assemblyNames)
              ? (v.assemblyNames[0] as string | undefined)
              : undefined)
          if (assemblyName) {
            try {
              await navToLocString.call(view, locString, assemblyName)
            } catch {
              return err(
                'Failed to navigate to locString',
                {
                  viewId: view.id,
                  viewType: selectedViewType,
                  created,
                  assembly: assemblyName,
                  locString,
                },
                ['Use the FindFeature tool to search for features by name.'],
              )
            }
          }
        }
      }

      return ok(
        created ? 'Created new view' : 'Reused existing view',
        {
          viewId: view.id,
          viewType: selectedViewType,
          created,
          assembly,
          locString,
        },
        initializationTimedOut
          ? [
              'View is still initializing; follow-up actions may need a short retry.',
            ]
          : undefined,
      )
    },
})
