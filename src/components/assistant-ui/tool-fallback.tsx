import type { ToolCallMessagePartComponent } from '@assistant-ui/react'
import type { HITLRequest, HITLResponse } from 'langchain'
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  Clock3Icon,
  XIcon,
} from 'lucide-react'
import React, { useState } from 'react'

import { Button } from '@/components/ui/button'

export const ToolFallback: ToolCallMessagePartComponent = ({
  toolName,
  argsText,
  result,
  interrupt,
  resume,
}) => {
  const isAwaitingReview = interrupt?.type === 'human' && result === undefined
  const [isCollapsed, setIsCollapsed] = useState(!isAwaitingReview)
  const hitlPayload = interrupt?.payload as HITLRequest | undefined
  const reviewConfig = hitlPayload?.reviewConfigs?.find(
    config => config.actionName === toolName,
  )
  const description = hitlPayload?.actionRequests?.[0]?.description
  const allowedDecisions = reviewConfig?.allowedDecisions ?? [
    'approve',
    'reject',
  ]

  return (
    <div className="aui-tool-fallback-root mb-4 flex w-full flex-col gap-3 rounded-lg border py-3">
      <div className="aui-tool-fallback-header flex items-center gap-2 px-4">
        {isAwaitingReview ? (
          <Clock3Icon className="aui-tool-fallback-icon size-4" />
        ) : (
          <CheckIcon className="aui-tool-fallback-icon size-4" />
        )}
        <p className="aui-tool-fallback-title flex-grow">
          {isAwaitingReview ? 'Awaiting review:' : 'Used tool:'}{' '}
          <b>{toolName}</b>
        </p>
        <Button onClick={() => setIsCollapsed(!isCollapsed)}>
          {isCollapsed ? <ChevronUpIcon /> : <ChevronDownIcon />}
        </Button>
      </div>
      {!isCollapsed && (
        <div className="aui-tool-fallback-content flex flex-col gap-2 border-t pt-2">
          <div className="aui-tool-fallback-args-root px-4">
            <pre className="aui-tool-fallback-args-value whitespace-pre-wrap">
              {argsText}
            </pre>
          </div>
          {isAwaitingReview ? (
            <div className="flex flex-col gap-3 border-t border-dashed px-4 pt-2">
              <div className="text-sm text-muted-foreground">
                {description ?? 'Review this tool call before continuing.'}
              </div>
              <div className="flex gap-2">
                {allowedDecisions.includes('approve') ? (
                  <Button
                    size="sm"
                    onClick={() =>
                      resume({
                        decisions: [{ type: 'approve' }],
                      } as HITLResponse)
                    }
                  >
                    Approve
                  </Button>
                ) : null}
                {allowedDecisions.includes('reject') ? (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() =>
                      resume({
                        decisions: [
                          {
                            type: 'reject',
                            message: `Rejected ${toolName}`,
                          },
                        ],
                      } as HITLResponse)
                    }
                  >
                    <XIcon className="size-4" />
                    Reject
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
          {result !== undefined && (
            <div className="aui-tool-fallback-result-root border-t border-dashed px-4 pt-2">
              <p className="aui-tool-fallback-result-header font-semibold">
                Result:
              </p>
              <pre className="aui-tool-fallback-result-content whitespace-pre-wrap">
                {typeof result === 'string'
                  ? result
                  : JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
