import { AbstractViewModel, Region } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

interface BookmarkLocation {
  refName: string
  start: number
  end: number
  locString: string
}

export interface BookmarkViewState {
  assembly?: string
  locations: BookmarkLocation[]
}

export function hasDisplayedRegions(
  view: AbstractViewModel,
): view is AbstractViewModel & { displayedRegions: Region[] } {
  return 'displayedRegions' in view
}

export function getLinearGenomeViews(views: AbstractViewModel[]) {
  return views.filter(
    v => v.type === 'LinearGenomeView',
  ) as LinearGenomeViewModel[]
}

export function selectLinearGenomeView(
  views: LinearGenomeViewModel[],
  viewId?: string,
) {
  return (viewId ? views.find(v => v.id === viewId) : views[0]) ?? views[0]
}

export function getBookmarkViewState(
  view: AbstractViewModel,
): BookmarkViewState {
  const assembly =
    'assemblyNames' in view
      ? (view as LinearGenomeViewModel).assemblyNames?.[0]
      : undefined

  const locations = hasDisplayedRegions(view)
    ? view.displayedRegions.map(region => ({
        refName: region.refName,
        start: region.start,
        end: region.end,
        locString: `${region.refName}:${(region.start + 1).toLocaleString()}-${region.end.toLocaleString()}`,
      }))
    : []

  return { assembly, locations }
}
