import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { AbstractSessionModel, AbstractViewModel } from '@jbrowse/core/util'

export interface NormalizedTrackConfig {
  id: string
  name: string
  assemblyNames: string[]
  type: string
}

function uniq(values: string[]) {
  return [...new Set(values)]
}

export function getLoadedAssemblies(session: AbstractSessionModel): string[] {
  return session.assemblyManager.assemblies.map(a => a.name)
}

export function getViewAssemblies(views: AbstractViewModel[]): string[] {
  return uniq(
    views
      .flatMap(v =>
        'assemblyNames' in v &&
        Array.isArray((v as { assemblyNames: unknown }).assemblyNames)
          ? (v as { assemblyNames: string[] }).assemblyNames
          : [],
      )
      .filter(Boolean),
  )
}

export function resolveActiveAssemblies({
  session,
  views,
  targetAssembly,
}: {
  session: AbstractSessionModel
  views: AbstractViewModel[]
  targetAssembly?: string
}): string[] {
  if (targetAssembly) {
    return [targetAssembly]
  }

  const fromViews = getViewAssemblies(views)
  if (fromViews.length > 0) {
    return fromViews
  }

  return getLoadedAssemblies(session)
}

export function getSessionTracks(
  session: AbstractSessionModel,
): NormalizedTrackConfig[] {
  return (session.jbrowse.tracks as AnyConfigurationModel[])
    .map(track => ({
      id: String(track.trackId ?? ''),
      name: String(track.name ?? ''),
      assemblyNames: Array.isArray(track.assemblyNames)
        ? (track.assemblyNames as unknown[]).map(a => String(a))
        : [],
      type: String(track.type ?? ''),
    }))
    .filter(track => Boolean(track.id))
}
