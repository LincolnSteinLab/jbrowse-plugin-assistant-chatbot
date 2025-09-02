import type { ReasoningMessagePartComponent } from '@assistant-ui/react'
import { ZapIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react'
import React, { useState } from 'react'

import { Button } from '@/components/ui/button'

export const ReasoningMessagePart: ReasoningMessagePartComponent = ({
  text,
  status,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(true)

  if (!text && status?.type !== 'running') return null

  return (
    <div className="mb-4 flex w-full flex-col gap-3 rounded-lg border py-3">
      <div className="flex items-center gap-2 px-4">
        <ZapIcon className="size-4" />
        <p className="flex-grow">Reasoning</p>
        <div className="flex-grow" />
        <Button onClick={() => setIsCollapsed(!isCollapsed)}>
          {isCollapsed ? <ChevronUpIcon /> : <ChevronDownIcon />}
        </Button>
      </div>

      {!isCollapsed && text && (
        <div className="flex flex-col gap-2 border-t pt-2">
          <div className="px-4">
            <pre className="whitespace-pre-wrap m-0">{text}</pre>
          </div>
        </div>
      )}
    </div>
  )
}
