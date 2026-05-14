import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { BaseTrackModel } from '@jbrowse/core/pluggableElementTypes'
import {
  AbstractViewModel,
  AssemblyManager,
  getConfAssemblyNames,
} from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { z } from 'zod'

import { ToolEnvelope, ok } from './ToolEnvelope'
import { createTool } from './base'

export interface ConfigDiagnosticIssue {
  severity: 'error' | 'warning' | 'info'
  trackId?: string
  trackName?: string
  message: string
  suggestion?: string
}

export interface ConfigDiagnosticData {
  activeAssemblies: string[]
  totalTracks: number
  compatibleTracks: number
  issues: ConfigDiagnosticIssue[]
  summary: string
}

function assembliesOverlap(a: string[], b: string[]): boolean {
  return a.some(x => b.includes(x))
}

export const ConfigDiagnosticTool = createTool({
  name: 'ConfigDiagnostic',
  description:
    'Inspect the current JBrowse configuration for assembly mismatches, incompatible tracks, and rendering constraints. Returns a structured list of issues with suggested remediations. Useful before attempting track operations that may fail silently.',
  schema: z.object({
    targetAssembly: z
      .string()
      .optional()
      .describe(
        'Assembly name to check compatibility against. Defaults to the assembly active in the first open view.',
      ),
  }),
  factory_fn:
    ([allTracks, assemblyManager, views]: [
      allTracks: (AnyConfigurationModel & BaseTrackModel)[],
      assemblyManager: AssemblyManager,
      views: AbstractViewModel[],
    ]) =>
    // eslint-disable-next-line @typescript-eslint/require-await
    async ({ targetAssembly }): Promise<ToolEnvelope<ConfigDiagnosticData>> => {
      let activeAssemblies = targetAssembly
        ? [targetAssembly]
        : [
            ...new Set(
              views.flatMap(
                v => (v as LinearGenomeViewModel).assemblyNames ?? [],
              ),
            ),
          ]
      if (activeAssemblies.length === 0)
        activeAssemblies = assemblyManager.assemblyNamesList

      const issues: ConfigDiagnosticIssue[] = []
      let compatibleTracks = 0

      for (const track of allTracks) {
        const trackAssemblyNames = getConfAssemblyNames(track)
        if (trackAssemblyNames.length === 0) {
          issues.push({
            severity: 'warning',
            trackId: track.id,
            trackName: track.name,
            message: `Track "${track.name}" (${track.id}) has no assemblyNames declared.`,
            suggestion:
              'Check the track config and add the correct assemblyNames field.',
          })
          continue
        }

        const compatible = assembliesOverlap(
          trackAssemblyNames,
          activeAssemblies,
        )
        if (compatible) {
          compatibleTracks++
        } else {
          issues.push({
            severity: 'error',
            trackId: track.id,
            trackName: track.name,
            message: `Track "${track.name}" (${track.id}) has assemblyNames [${trackAssemblyNames.join(', ')}] which do not overlap the active assembly [${activeAssemblies.join(', ')}].`,
            suggestion: `Add a track compatible with assembly "${activeAssemblies[0]}", or switch the view assembly to one of [${trackAssemblyNames.join(', ')}].`,
          })
        }
      }

      if (views.length === 0) {
        issues.push({
          severity: 'info',
          message: 'No views are currently open.',
          suggestion: 'Use EnsureView to open a LinearGenomeView.',
        })
      }

      const errorCount = issues.filter(i => i.severity === 'error').length
      const warnCount = issues.filter(i => i.severity === 'warning').length

      const summary =
        issues.length === 0
          ? `All ${allTracks.length} track(s) are compatible with assembly [${activeAssemblies.join(', ')}].`
          : `Found ${errorCount} error(s) and ${warnCount} warning(s) across ${allTracks.length} track(s). ${compatibleTracks} track(s) are compatible with assembly [${activeAssemblies.join(', ')}].`

      return ok(summary, {
        activeAssemblies,
        totalTracks: allTracks.length,
        compatibleTracks,
        issues,
        summary,
      })
    },
})
