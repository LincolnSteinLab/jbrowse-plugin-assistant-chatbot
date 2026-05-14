import type { LinearSyntenyViewHelperModel } from '#_/@jbrowse/plugin-linear-comparative-view/esm/LinearSyntenyViewHelper/stateModelFactory'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { BaseTrackModel } from '@jbrowse/core/pluggableElementTypes'
import {
  AbstractViewModel,
  AssemblyManager,
  getConfAssemblyNames,
  isTrackViewModel,
} from '@jbrowse/core/util'
import { LinearSyntenyViewModel } from '@jbrowse/plugin-linear-comparative-view'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { z } from 'zod'

import { ToolEnvelope, err, needsInput, ok } from './ToolEnvelope'
import { createTool } from './base'

const COMPATIBLE_VIEW_TYPES = [
  'LinearGenomeView',
  'LinearSyntenyView',
  'LinearComparativeView',
]

export interface SetTrackVisibilityData {
  viewId?: string
  onlyCompatibleWithViewAssembly?: boolean
  level?: number
  shown: string[]
  hidden: string[]
  unmatched: string[]
  assemblyMismatches?: {
    query: string
    trackId: string
    viewAssemblies: string[]
    trackAssemblies: string[]
  }[]
  trackDiagnostics?: {
    trackId: string
    severity: 'warning' | 'error'
    message: string
  }[]
  unmatchedSuggestions?: {
    query: string
    candidates: string[]
  }[]
  ambiguous: {
    query: string
    candidates: string[]
  }[]
}

function isLinearComparativeView(
  view: AbstractViewModel,
): view is AbstractViewModel & LinearSyntenyViewModel {
  return 'levels' in view
}

function norm(value: string) {
  return value.trim().toLowerCase()
}

export const SetTrackVisibilityTool = createTool({
  name: 'SetTrackVisibility',
  description:
    'Show or hide tracks in a linear genome view. Pass exact track IDs from SessionSnapshot.availableTracks[].id for reliable, single-call matching. Display names are also accepted but may match ambiguously. Set onlyCompatibleWithViewAssembly=true to strictly filter show candidates to tracks compatible with the target view assembly. Returns assembly mismatch and render diagnostics so you can refine selection.',
  schema: z.object({
    show: z.array(z.string()).optional().default([]),
    hide: z.array(z.string()).optional().default([]),
    viewId: z.string().optional(),
    onlyCompatibleWithViewAssembly: z.boolean().optional().default(false),
    level: z.number().int().min(0).optional().default(0),
  }),
  factory_fn:
    ([allTracks, assemblyManager, views]: [
      allTracks: (AnyConfigurationModel & BaseTrackModel)[],
      assemblyManager: AssemblyManager,
      views: AbstractViewModel[],
    ]) =>
    async ({
      show,
      hide,
      viewId,
      onlyCompatibleWithViewAssembly,
      level,
      // eslint-disable-next-line @typescript-eslint/require-await
    }): Promise<ToolEnvelope<SetTrackVisibilityData>> => {
      const dedupedShow = [...new Set(show)]
      const dedupedHide = [...new Set(hide)]

      if (dedupedShow.length === 0 && dedupedHide.length === 0) {
        return err('Provide at least one track to show or hide', {
          shown: [],
          hidden: [],
          unmatched: [],
          ambiguous: [],
        })
      }

      const target = views.find(
        view =>
          (view.id === viewId || !viewId) &&
          COMPATIBLE_VIEW_TYPES.includes(view.type),
      )

      if (!target) {
        if (viewId) {
          const allCompatibleViews = views.filter(view =>
            COMPATIBLE_VIEW_TYPES.includes(view.type),
          )
          return err(
            'Requested viewId was not found among open compatible views',
            {
              level,
              shown: [],
              hidden: [],
              unmatched: [...dedupedShow, ...dedupedHide],
              unmatchedSuggestions: [],
              ambiguous: [],
            },
            [
              `Use one of the open view IDs: ${allCompatibleViews.map(v => v.id).join(', ')}`,
              'For synteny views, use the level parameter to target a specific gap between views (default=0)',
            ],
          )
        } else {
          return err(
            'No compatible view is open (LinearGenomeView, LinearSyntenyView, or LinearComparativeView)',
            {
              level,
              shown: [],
              hidden: [],
              unmatched: [...dedupedShow, ...dedupedHide],
              ambiguous: [],
            },
            [
              'Open a LinearGenomeView, LinearSyntenyView, or LinearComparativeView',
              'For synteny views, use the level parameter to target a specific gap between views (default=0)',
            ],
          )
        }
      }

      const targetAssemblyNames =
        (target as LinearGenomeViewModel).assemblyNames ?? []

      const isAssemblyCompatible = (trackAssemblyNames: string[]) => {
        if (!targetAssemblyNames.length || !trackAssemblyNames.length) {
          return true
        }
        return trackAssemblyNames.some(trackAssembly =>
          targetAssemblyNames.some(viewAssembly => {
            if (trackAssembly === viewAssembly) {
              return true
            }
            const assembly = assemblyManager.get(trackAssembly)
            return !!assembly?.hasName(viewAssembly)
          }),
        )
      }

      const shown: string[] = []
      const hidden: string[] = []
      const unmatched: string[] = []
      const assemblyMismatches: {
        query: string
        trackId: string
        viewAssemblies: string[]
        trackAssemblies: string[]
      }[] = []
      const trackDiagnostics: {
        trackId: string
        severity: 'warning' | 'error'
        message: string
      }[] = []
      const unmatchedSuggestions: {
        query: string
        candidates: string[]
      }[] = []
      const ambiguous: { query: string; candidates: string[] }[] = []

      const collectDiagnostics = (trackId: string, trackLevel: number) => {
        const selectedTrack = (
          (isLinearComparativeView(target)
            ? (target.levels[trackLevel] as
                | LinearSyntenyViewHelperModel
                | undefined)
            : (target as LinearGenomeViewModel)
          )?.tracks as BaseTrackModel[] | undefined
        )?.find(track => track.trackId === trackId)
        if (!selectedTrack) {
          return
        }
        const messages = new Set<string>()
        for (const display of selectedTrack.displays ?? []) {
          const anyDisplay = display as AbstractViewModel & {
            error?: unknown
            cannotBeRenderedReason?: string
            regionTooLarge?: boolean
            regionTooLargeReason?: string
            regionCannotBeRenderedText?: (region: unknown) => string
          }

          if (anyDisplay.error instanceof Error) {
            messages.add(anyDisplay.error.message)
          } else if (typeof anyDisplay.error === 'string') {
            messages.add(anyDisplay.error)
          }

          if (anyDisplay.cannotBeRenderedReason) {
            messages.add(anyDisplay.cannotBeRenderedReason)
          }

          if (anyDisplay.regionTooLarge) {
            messages.add(
              anyDisplay.regionTooLargeReason ??
                'Zoom in to see features or force load (may be slow)',
            )
          }

          const firstRegion = isLinearComparativeView(target)
            ? (target.views[trackLevel].displayedRegions[0] ??
              target.views[0].displayedRegions[0])
            : (target as LinearGenomeViewModel).displayedRegions[0]
          if (
            firstRegion &&
            typeof anyDisplay.regionCannotBeRenderedText === 'function'
          ) {
            try {
              const msg = anyDisplay.regionCannotBeRenderedText(firstRegion)
              if (msg) {
                messages.add(msg)
              }
            } catch (error) {
              messages.add(
                error instanceof Error
                  ? error.message
                  : 'Failed to retrieve renderer diagnostic text',
              )
            }
          }
        }

        for (const message of messages) {
          const severity = /error|does not match/i.test(message)
            ? 'error'
            : 'warning'
          trackDiagnostics.push({ trackId, severity, message })
        }
      }

      const suggest = (query: string) => {
        const q = norm(query)
        const filteredTracks = onlyCompatibleWithViewAssembly
          ? allTracks.filter(t => isAssemblyCompatible(getConfAssemblyNames(t)))
          : allTracks
        return filteredTracks
          .filter(t => {
            const id = t.id ? norm(String(t.id)) : ''
            const name = t.name ? norm(String(t.name)) : ''
            return id.includes(q) || name.includes(q) || q.includes(id)
          })
          .map(t => String(t.id ?? t.name))
          .filter(Boolean)
          .slice(0, 8)
      }

      const resolve = (query: string, forShow: boolean) => {
        const q = norm(query)
        const candidateTracks =
          forShow && onlyCompatibleWithViewAssembly
            ? allTracks.filter(t =>
                isAssemblyCompatible(getConfAssemblyNames(t)),
              )
            : allTracks
        // Prefer exact ID match, then exact name match, then substring match
        const exactId = candidateTracks.filter(
          t => !!t.id && norm(String(t.id)) === q,
        )
        if (exactId.length > 0) return exactId
        const exactName = candidateTracks.filter(
          t => !!t.name && norm(String(t.name)) === q,
        )
        if (exactName.length > 0) return exactName
        return candidateTracks.filter(
          t =>
            (!!t.id && norm(String(t.id)).includes(q)) ||
            (!!t.name && norm(String(t.name)).includes(q)),
        )
      }

      for (const q of dedupedShow) {
        const matches = resolve(q, true)
        if (matches.length === 0) {
          const allMatches = resolve(q, false)
          if (onlyCompatibleWithViewAssembly && allMatches.length > 0) {
            const incompatibleMatches = allMatches.filter(
              match => !isAssemblyCompatible(getConfAssemblyNames(match)),
            )
            for (const match of incompatibleMatches) {
              assemblyMismatches.push({
                query: q,
                trackId: String(match.id ?? ''),
                viewAssemblies: targetAssemblyNames,
                trackAssemblies: getConfAssemblyNames(match),
              })
            }
            continue
          }
          unmatched.push(q)
          const candidates = suggest(q)
          if (candidates.length > 0) {
            unmatchedSuggestions.push({ query: q, candidates })
          }
          continue
        }
        if (matches.length > 1) {
          ambiguous.push({
            query: q,
            candidates: matches
              .map(m => String(m.id ?? m.name))
              .filter(Boolean)
              .slice(0, 8),
          })
          continue
        }
        const trackId = String(matches[0]?.id ?? '')
        if (!trackId) {
          unmatched.push(q)
          continue
        }

        const trackAssemblyNames = getConfAssemblyNames(matches[0])
        if (!isAssemblyCompatible(trackAssemblyNames)) {
          assemblyMismatches.push({
            query: q,
            trackId,
            viewAssemblies: targetAssemblyNames,
            trackAssemblies: trackAssemblyNames,
          })
          continue
        }

        if (isLinearComparativeView(target)) {
          target.showTrack(trackId, level)
          shown.push(trackId)
        } else if (isTrackViewModel(target)) {
          target.showTrack(trackId)
          shown.push(trackId)
        }
        collectDiagnostics(trackId, level)
      }

      for (const q of dedupedHide) {
        const matches = resolve(q, false)
        if (matches.length === 0) {
          unmatched.push(q)
          const candidates = suggest(q)
          if (candidates.length > 0) {
            unmatchedSuggestions.push({ query: q, candidates })
          }
          continue
        }
        if (matches.length > 1) {
          ambiguous.push({
            query: q,
            candidates: matches
              .map(m => String(m.id ?? m.name))
              .filter(Boolean)
              .slice(0, 8),
          })
          continue
        }
        const trackId = String(matches[0]?.id ?? '')
        if (!trackId) {
          unmatched.push(q)
          continue
        }
        if (isLinearComparativeView(target)) {
          target.hideTrack(trackId, level)
          hidden.push(trackId)
        } else if (isTrackViewModel(target)) {
          target.hideTrack(trackId)
          hidden.push(trackId)
        } else {
          unmatched.push(q)
        }
      }

      if (ambiguous.length > 0) {
        return needsInput(
          'Some track queries matched multiple tracks',
          {
            viewId: target?.id,
            onlyCompatibleWithViewAssembly,
            level,
            shown,
            hidden,
            unmatched,
            assemblyMismatches,
            trackDiagnostics,
            unmatchedSuggestions,
            ambiguous,
          },
          ['Provide exact track IDs for ambiguous entries'],
        )
      }

      if (unmatched.length > 0 && shown.length === 0 && hidden.length === 0) {
        return needsInput(
          'No requested tracks were updated because none matched exactly',
          {
            viewId: target?.id,
            onlyCompatibleWithViewAssembly,
            level,
            shown,
            hidden,
            unmatched,
            assemblyMismatches,
            trackDiagnostics,
            unmatchedSuggestions,
            ambiguous,
          },
          ['Use exact track IDs from SessionSnapshot.availableTracks'],
        )
      }

      if (assemblyMismatches.length > 0 || trackDiagnostics.length > 0) {
        return needsInput(
          'Some requested tracks may be unsuitable for the current view region',
          {
            viewId: target?.id,
            onlyCompatibleWithViewAssembly,
            shown,
            hidden,
            unmatched,
            assemblyMismatches,
            trackDiagnostics,
            unmatchedSuggestions,
            ambiguous,
          },
          [
            'Prefer tracks where track assemblyNames overlap the view assembly',
            'Re-run with onlyCompatibleWithViewAssembly=true to enforce assembly-safe track selection',
            'If diagnostics indicate force load, zoom in before selecting that track',
          ],
        )
      }

      return ok('Track visibility updated', {
        viewId: target?.id,
        onlyCompatibleWithViewAssembly,
        level,
        shown,
        hidden,
        unmatched,
        assemblyMismatches,
        trackDiagnostics,
        unmatchedSuggestions,
        ambiguous,
      })
    },
})
