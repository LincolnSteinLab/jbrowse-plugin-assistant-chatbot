import { ViewType } from '@jbrowse/core/pluggableElementTypes'
import {
  AbstractViewContainer,
  AbstractViewModel,
  AssemblyManager,
  when,
} from '@jbrowse/core/util'
import { z } from 'zod'

import { ToolEnvelope, err, needsInput, ok } from './ToolEnvelope'
import { createTool, withTimeout } from './base'
import { getPreferredViewType, isNavigableView } from './viewCapabilities'

export interface EnsureViewData {
  viewId?: string
  viewType: string
  created: boolean
  assembly?: string
  locString?: string
  assemblyList?: string[]
}

const COMPARATIVE_VIEW_TYPES = ['LinearSyntenyView', 'LinearComparativeView']

function isComparativeViewType(viewType: string): boolean {
  return COMPARATIVE_VIEW_TYPES.includes(viewType)
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
  return state.showLoading ?? !!state.initPresent
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
    assemblyList: z
      .array(z.string())
      .optional()
      .describe(
        'For comparative/synteny views: ordered list of assembly names to initialize the view with. Provide at least 2 entries.',
      ),
    reuseExisting: z.boolean().optional().default(true),
  }),
  factory_fn:
    ([addView, viewTypes, views, assemblyManager]: [
      addView: AbstractViewContainer['addView'],
      viewTypes: ViewType[],
      views: AbstractViewModel[],
      assemblyManager: AssemblyManager,
    ]) =>
    async ({
      viewType,
      preferredCapability,
      assembly,
      locString,
      assemblyList,
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
        if (isComparativeViewType(selectedViewType)) {
          // For comparative views, require explicit assemblyList
          if (!assemblyList || assemblyList.length === 0) {
            const available = assemblyManager.assemblies
              .map(a => a.name)
              .filter(Boolean)
            return needsInput(
              'Comparative views require an explicit list of assemblies',
              { viewType: selectedViewType, created: false },
              available.length >= 2
                ? [
                    `Pass assemblyList with at least 2 assemblies, e.g. ["${available[0]}", "${available[1]}"]`,
                  ]
                : available.length === 1
                  ? [
                      `Only one assembly loaded: ${available[0]}. Load a second assembly and then pass assemblyList.`,
                    ]
                  : [
                      'Load at least two assemblies first, then pass assemblyList.',
                    ],
            )
          }

          const resolvedAssemblies = assemblyList.filter(Boolean)
          if (resolvedAssemblies.length < 2) {
            return needsInput(
              'Comparative views require at least two assemblies in assemblyList',
              {
                viewType: selectedViewType,
                created: false,
                assemblyList: resolvedAssemblies,
              },
              ['Provide at least two assembly names in assemblyList.'],
            )
          }

          const initViews = resolvedAssemblies.map(name => ({
            assembly: name,
          }))
          const init = {
            views: initViews,
          }
          view = addView(selectedViewType, { init })
        } else {
          // For non-comparative views, require explicit assembly
          if (!assembly) {
            const available = assemblyManager.assemblies
              .map(a => a.name)
              .filter(Boolean)
            return needsInput(
              `${selectedViewType} requires an assembly to be specified`,
              { viewType: selectedViewType, created: false },
              available.length > 0
                ? [`Pass assembly parameter, for example: "${available[0]}"`]
                : ['Load at least one assembly first, then pass assembly.'],
            )
          }
          view = addView(selectedViewType)
        }
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

      // Try to navigate if locString provided and view is navigable.
      // Comparative views do not expose navToLocString at the top level;
      // navigation is handled via child view init locs instead.
      if (
        locString &&
        !isComparativeViewType(selectedViewType) &&
        isNavigableView(view)
      ) {
        const assemblyName = assembly ?? view.assemblyNames[0]
        try {
          await view.navToLocString(locString, assemblyName)
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

      return ok(
        created ? 'Created new view' : 'Reused existing view',
        {
          viewId: view.id,
          viewType: selectedViewType,
          created,
          assembly,
          locString,
          assemblyList: assemblyList?.length ? assemblyList : undefined,
        },
        initializationTimedOut
          ? [
              'View is still initializing; follow-up actions may need a short retry.',
            ]
          : undefined,
      )
    },
})
