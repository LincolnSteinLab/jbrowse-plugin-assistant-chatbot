import { AbstractViewModel } from '@jbrowse/core/util'
import { LinearSyntenyViewModel } from '@jbrowse/plugin-linear-comparative-view'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type ComparativeViewLike = AbstractViewModel & {
  views?: AbstractViewModel[]
}

/**
 * Capability detection utilities for JBrowse view types.
 * Supports both native and plugin-provided views without hardcoding type names.
 */

/**
 * Check if a view supports multiple assemblies (comparative analysis).
 * Multi-assembly views typically have an assemblyNames array with multiple entries
 * or are specifically designed for comparative genomics (e.g., synteny, dotplot).
 */
export function isMultiAssemblyView(view: AbstractViewModel): boolean {
  const v = view as LinearSyntenyViewModel
  return (v.assemblyNames ?? []).length > 1 || (v.views ?? []).length > 1
}

/**
 * Check if a view supports navigation via locString.
 */
export function isNavigableView(
  view: AbstractViewModel,
): view is LinearGenomeViewModel {
  return typeof (view as LinearGenomeViewModel).navToLocString === 'function'
}

/**
 * Get all view types from a list that support multi-assembly workflows.
 * Returns the view type names of views that can display multiple assemblies.
 */
export function getMultiAssemblyViewTypes(
  views: AbstractViewModel[],
): string[] {
  return [...new Set(views.filter(isMultiAssemblyView).map(v => v.type))]
}

/**
 * Get all views from a list that support navigation.
 * Returns actual view instances that can be navigated.
 */
export function getNavigableViews(
  views: AbstractViewModel[],
): LinearGenomeViewModel[] {
  return views.filter(isNavigableView)
}

/**
 * Check whether a view exposes child views that can be navigated via locString.
 * This is used for comparative views (e.g. LinearSyntenyView / LinearComparativeView)
 * where navigation happens on child LinearGenomeView rows.
 */
export function hasNavigableComparativeRows(view: AbstractViewModel): boolean {
  const v = view as ComparativeViewLike
  return (
    Array.isArray(v.views) &&
    v.views.length > 0 &&
    v.views.some(child => isNavigableView(child))
  )
}

/**
 * Get child rows from a comparative view that support locString navigation.
 */
export function getNavigableComparativeRows(
  view: AbstractViewModel,
): LinearGenomeViewModel[] {
  const v = view as ComparativeViewLike
  return Array.isArray(v.views) ? v.views.filter(isNavigableView) : []
}

/**
 * Get top-level views that support locString navigation either directly
 * (LinearGenomeView) or indirectly through comparative child rows.
 */
export function getLocStringNavigableViews(
  views: AbstractViewModel[],
): AbstractViewModel[] {
  return views.filter(
    view => isNavigableView(view) || hasNavigableComparativeRows(view),
  )
}

/**
 * Get all view types from a list that support navigation.
 * Returns the view type names of views that support navigation.
 */
export function getNavigableViewTypes(views: AbstractViewModel[]): string[] {
  return [...new Set(getNavigableViews(views).map(v => v.type))]
}

/**
 * Suggest the best view type for a given task from available view type names.
 * Priority order: task-specific > multi-assembly > linear > fallback.
 */
export function getPreferredViewType(
  task:
    | 'comparative'
    | 'multi-assembly'
    | 'navigation'
    | 'linear'
    | 'feature'
    | 'circular'
    | 'any',
  availableViewTypes: string[],
): string | undefined {
  if (availableViewTypes.length === 0) {
    return undefined
  }

  // Task-specific preferences
  if (task === 'comparative' || task === 'multi-assembly') {
    // Prefer LinearSyntenyView, then DotplotView, then any multi-assembly type
    const preferences = ['LinearSyntenyView', 'DotplotView', 'CircularView']
    for (const pref of preferences) {
      if (availableViewTypes.includes(pref)) {
        return pref
      }
    }
  }

  if (task === 'linear' || task === 'navigation') {
    // Prefer LinearGenomeView, then any navigable type
    if (availableViewTypes.includes('LinearGenomeView')) {
      return 'LinearGenomeView'
    }
  }

  if (task === 'feature') {
    // Prefer SpreadsheetView for feature-centric work
    if (availableViewTypes.includes('SpreadsheetView')) {
      return 'SpreadsheetView'
    }
    // Fallback to linear
    if (availableViewTypes.includes('LinearGenomeView')) {
      return 'LinearGenomeView'
    }
  }

  if (task === 'circular') {
    if (availableViewTypes.includes('CircularView')) {
      return 'CircularView'
    }
  }

  if (task === 'any') {
    // Return first available (usually good enough)
    return availableViewTypes[0]
  }

  // Fallback: return first available view type
  return availableViewTypes[0]
}

/**
 * Get display name for a view type for use in user-facing messages.
 * Handles known types and provides sensible defaults for unknown types.
 */
export function getViewTypeDisplayName(viewType: string): string {
  const displayNames: Record<string, string> = {
    LinearGenomeView: 'Linear genome view',
    LinearSyntenyView: 'Linear synteny view',
    DotplotView: 'Dotplot view',
    CircularView: 'Circular view',
    BreakpointSplitView: 'Breakpoint split view',
    SvInspectorView: 'SV inspector view',
    SpreadsheetView: 'Spreadsheet view',
  }
  return displayNames[viewType] ?? viewType
}
