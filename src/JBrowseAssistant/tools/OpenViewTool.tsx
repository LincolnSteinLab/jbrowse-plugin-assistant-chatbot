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
  description: 'Open a new view in JBrowse',
  schema: z.object({
    viewType: z.string().describe('Type of view to open'),
  }),
  factory_fn:
    (
      {
        addView,
        viewTypes,
      }: {
        addView: (viewType: string) => AbstractViewModel
        viewTypes: ViewType[]
      },
      { human },
    ) =>
    async ({ viewType }, _, config) => {
      const viewTypeNames = viewTypes.map(vt => vt.name)
      if (!viewTypeNames.includes(viewType)) {
        return {
          result: 'not found',
          availableViewTypes: viewTypeNames,
        }
      }
      const approved = await human({
        config,
        payload: viewType,
      })
      if (!approved)
        return {
          result: 'skipped',
        }
      const newView = addView(viewType)
      if ((newView as object).hasOwnProperty('initialized')) {
        await when(
          () =>
            (newView as AbstractViewModel & { initialized: boolean })
              .initialized,
        )
        return {
          result: 'success',
          view: newView,
        }
      } else {
        console.error('View does not have initialized property')
        return {
          result: 'success',
          view: newView,
        }
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
