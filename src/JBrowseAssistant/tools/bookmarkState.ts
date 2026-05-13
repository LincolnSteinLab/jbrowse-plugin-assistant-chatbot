import { AbstractViewModel } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export function getLinearGenomeViews(views: AbstractViewModel[]) {
  return views.filter(
    v => v.type === 'LinearGenomeView',
  ) as LinearGenomeViewModel[]
}

export function selectOrFirst<T extends object>(
  array: T[],
  selection?: Partial<T>,
): T {
  return selection
    ? (array.find(item =>
        Object.entries(selection).every(([k, v]) => item[k as keyof T] === v),
      ) ?? array[0])
    : array[0]
}
