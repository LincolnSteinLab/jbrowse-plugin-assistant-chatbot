import { IBaseViewModelWithDisplayedRegions } from '@jbrowse/core/pluggableElementTypes/models/BaseViewModel'
import { AbstractViewModel } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export function hasDisplayedRegions<T extends object>(
  view: T,
): view is T & IBaseViewModelWithDisplayedRegions {
  return 'displayedRegions' in view
}

export function getLinearGenomeViews(views: AbstractViewModel[]) {
  return views.filter(
    v => v.type === 'LinearGenomeView',
  ) as LinearGenomeViewModel[]
}

export function selectById<T extends { id: string }>(array: T[], id?: string) {
  return (id ? array.find(v => v.id === id) : array[0]) ?? array[0]
}
