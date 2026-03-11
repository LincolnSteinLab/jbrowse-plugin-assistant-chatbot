import { ViewType } from '@jbrowse/core/pluggableElementTypes'
import { AbstractViewModel, when } from '@jbrowse/core/util'
import {
  MessageCircleQuestionIcon,
  SquareCheckBigIcon,
  SquareXIcon,
} from 'lucide-react'
import React from 'react'
import { z } from 'zod'

import { ToolFallback } from '@/components/assistant-ui/tool-fallback'
import { Button } from '@/components/ui/button'

import { createTool } from './base'

export const OpenViewTool = createTool({
  name: 'OpenView',
  description:
    'Open a new view in JBrowse (optionally with init state like loc/tracks)',
  schema: z.object({
    viewType: z.string().describe('Type of view to open'),
    init: z
      .record(z.string(), z.unknown())
      .optional()
      .describe(
        'Optional init object passed to the view (e.g., { loc, assembly, tracks })',
      ),
  }),
  factory_fn:
    ({
      addView,
      viewTypes,
    }: {
      addView: (
        viewType: string,
        initialState?: Record<string, unknown>,
      ) => AbstractViewModel
      viewTypes: ViewType[]
    }) =>
    async ({ viewType, init }) => {
      const viewTypeNames = viewTypes.map(vt => vt.name)
      if (!viewTypeNames.includes(viewType)) {
        return {
          result: 'not found',
          availableViewTypes: viewTypeNames,
        }
      }

      // create view using init as initial state so view's autoruns handle nav/tracks
      const newView = addView(viewType, init ?? {})
      // wait for initialization flag if present
      if ((newView as object).hasOwnProperty('initialized')) {
        try {
          await when(
            () =>
              (newView as AbstractViewModel & { initialized: boolean })
                .initialized,
            { timeout: 5000 },
          )
        } catch (e) {
          console.error(e)
          return {
            result: 'success',
            view: newView,
            note: 'view created; initialization timeout waiting for initialized=true',
            viewId: newView.id ?? null,
          }
        }
      }

      return {
        result: 'success',
        view: newView,
        viewId: newView.id ?? null,
      }
    },
  render: toolCall => {
    const { interrupt, resume, toolName } = toolCall
    if (interrupt)
      return (
        <div className="aui-tool-fallback-root mb-4 flex w-full flex-col gap-3 rounded-lg border py-3">
          <div className="aui-tool-fallback-header flex items-center gap-2 px-4">
            <MessageCircleQuestionIcon className="aui-tool-fallback-icon size-4" />
            <p className="aui-tool-fallback-title flex-grow">
              Tool Request: <b>{toolName}</b>
            </p>
            <Button onClick={() => resume(true)}>
              <SquareCheckBigIcon />
            </Button>
            <Button onClick={() => resume(false)}>
              <SquareXIcon />
            </Button>
          </div>
        </div>
      )
    return <ToolFallback {...toolCall} />
  },
})
