import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { BaseTrackModel } from '@jbrowse/core/pluggableElementTypes'
import {
  AbstractViewModel,
  AssemblyManager,
  getConfAssemblyNames,
} from '@jbrowse/core/util'
import { z } from 'zod'

import { ToolEnvelope, err, ok } from './ToolEnvelope'
import { createTool } from './base'
import {
  getMultiAssemblyViewTypes,
  getViewTypeDisplayName,
} from './viewCapabilities'

export interface SyntenySetupData {
  sourceAssembly: string
  targetAssembly: string
  resolvedComparativeTrackIds: string[]
  availableComparativeViewTypes: string[]
  missingTrackQueries: string[]
  compatibilityIssues: {
    trackId: string
    trackAssemblies: string[]
    reason: string
  }[]
  nextActions: string[]
}

function matchesTrack(track: { id: string; name: string }, query: string) {
  const q = query.trim().toLowerCase()
  return (
    track.id.trim().toLowerCase() === q || track.name.trim().toLowerCase() === q
  )
}

export const SyntenySetupTool = createTool({
  name: 'SyntenySetup',
  description:
    'Validate source/target assembly context and resolve comparative track IDs for a synteny workflow bootstrap. Returns compatible track IDs, compatibility issues, and concrete next actions.',
  mcp: false,
  schema: z.object({
    sourceAssembly: z.string(),
    targetAssembly: z.string(),
    comparativeTrackQueries: z.array(z.string()).optional().default([]),
  }),
  factory_fn:
    ([allTracks, assemblyManager, views]: [
      allTracks: (AnyConfigurationModel & BaseTrackModel)[],
      assemblyManager: AssemblyManager,
      views: AbstractViewModel[],
    ]) =>
    async ({
      sourceAssembly,
      targetAssembly,
      comparativeTrackQueries,
      // eslint-disable-next-line @typescript-eslint/require-await
    }): Promise<ToolEnvelope<SyntenySetupData>> => {
      const source = sourceAssembly.trim()
      const target = targetAssembly.trim()
      if (!source || !target) {
        return err('sourceAssembly and targetAssembly must be non-empty', {
          sourceAssembly: source,
          targetAssembly: target,
          resolvedComparativeTrackIds: [],
          availableComparativeViewTypes: [],
          missingTrackQueries: comparativeTrackQueries,
          compatibilityIssues: [],
          nextActions: [
            'Provide both sourceAssembly and targetAssembly as non-empty strings.',
          ],
        })
      }

      const loadedAssemblies = new Set(assemblyManager.assemblyNamesList)

      const missingTrackQueries: string[] = []
      const resolvedComparativeTrackIds: string[] = []
      const compatibilityIssues: SyntenySetupData['compatibilityIssues'] = []
      const availableComparativeViewTypes = getMultiAssemblyViewTypes(views)

      for (const query of comparativeTrackQueries) {
        const match = allTracks.find(track =>
          matchesTrack({ id: track.id, name: track.name }, query),
        )
        if (!match) {
          missingTrackQueries.push(query)
          continue
        }

        const trackAssemblies = getConfAssemblyNames(match)
        if (
          trackAssemblies.includes(source) &&
          trackAssemblies.includes(target)
        ) {
          resolvedComparativeTrackIds.push(match.id)
        } else {
          compatibilityIssues.push({
            trackId: match.id,
            trackAssemblies,
            reason: `Track does not cover both requested assemblies (${source}, ${target})`,
          })
        }
      }

      const nextActions: string[] = []
      if (!loadedAssemblies.has(source) || !loadedAssemblies.has(target)) {
        nextActions.push(
          `Load both assemblies before setup. Missing: ${[
            !loadedAssemblies.has(source) ? source : null,
            !loadedAssemblies.has(target) ? target : null,
          ]
            .filter(Boolean)
            .join(', ')}.`,
        )
      }

      if (resolvedComparativeTrackIds.length > 0) {
        const viewTypeList =
          availableComparativeViewTypes.length > 0
            ? availableComparativeViewTypes
                .map(getViewTypeDisplayName)
                .join(', ')
            : 'a view supporting multi-assembly analysis (e.g., LinearSyntenyView, DotplotView)'
        nextActions.push(
          `Open a view suitable for comparative analysis with EnsureView. Available: ${viewTypeList}. Then enable comparative tracks with SetTrackVisibility: ${resolvedComparativeTrackIds.join(', ')}.`,
        )
      }

      if (missingTrackQueries.length > 0) {
        nextActions.push(
          `Clarify or correct unresolved comparative track queries: ${missingTrackQueries.join(', ')}.`,
        )
      }

      if (compatibilityIssues.length > 0) {
        nextActions.push(
          'Choose tracks whose assemblyNames include both source and target assemblies.',
        )
      }

      if (nextActions.length === 0) {
        nextActions.push(
          'Run WorkflowOrchestrator for the synteny_setup flow to continue stepwise execution.',
        )
      }

      return ok('Prepared synteny setup bootstrap analysis', {
        sourceAssembly: source,
        targetAssembly: target,
        resolvedComparativeTrackIds,
        availableComparativeViewTypes,
        missingTrackQueries,
        compatibilityIssues,
        nextActions,
      })
    },
})
