import { AbstractViewModel } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

import { createTool, EmptySchema } from './base'

interface CompactableDisplay {
  setFeatureHeight: (h: number) => void
  setNoSpacing?: (flag: boolean) => void
}

function setCompactMode(display: CompactableDisplay) {
  display.setFeatureHeight(2)
  if (display.setNoSpacing) {
    display.setNoSpacing(true)
  }
}

export const SetCompactDisplayTool = createTool({
  name: 'SetCompactDisplay',
  description:
    'Set all visible tracks in linear genome views to compact display mode',
  schema: EmptySchema,
  factory_fn:
    (views: AbstractViewModel[]) =>
    // eslint-disable-next-line @typescript-eslint/require-await
    async () => {
      const lgviews = views.filter(
        view => view.type === 'LinearGenomeView',
      ) as LinearGenomeViewModel[]
      if (lgviews.length === 0) {
        return { result: 'no Linear Genome Views are open' }
      }
      let tracksModified = 0
      for (const lgview of lgviews) {
        for (const track of lgview.tracks) {
          const display = track.displays[0] as
            | (Record<string, unknown> & { PileupDisplay?: unknown })
            | undefined
          if (display) {
            // for alignments tracks, the PileupDisplay is a subdisplay
            const pileupDisplay = display.PileupDisplay as
              | CompactableDisplay
              | undefined
            if (pileupDisplay && 'setFeatureHeight' in pileupDisplay) {
              setCompactMode(pileupDisplay)
              tracksModified++
            } else if ('setFeatureHeight' in display) {
              setCompactMode(display as unknown as CompactableDisplay)
              tracksModified++
            }
          }
        }
      }
      return {
        result: 'success',
        tracksModified,
      }
    },
})
