import {
  ChatModelAdapter,
  ChatModelRunOptions,
  ChatModelRunResult,
  ThreadMessage,
  ToolCallMessagePart,
} from '@assistant-ui/react'
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  BaseMessageFields,
  HumanMessage,
  isAIMessage,
  isAIMessageChunk,
  isBaseMessage,
  isToolMessage,
  SystemMessage,
} from '@langchain/core/messages'

import { ChatAgent } from './agent/ChatAgent'
import { JBTool } from './tools/base'

function getLangchainMessages(
  messages: readonly ThreadMessage[],
): BaseMessage[] {
  return messages.map((tm: ThreadMessage) => {
    const fields: BaseMessageFields = {
      content: tm.content
        .filter(part => part.type === 'text')
        .map(part => ({ type: 'text', text: part.text })),
      id: tm.id,
    }
    switch (tm.role) {
      case 'system':
        return new SystemMessage(fields)
      case 'assistant':
        return new AIMessage(fields)
      case 'user':
        return new HumanMessage(fields)
    }
  })
}

function getLangchainTools(tools: Record<string, JBTool['tool']>) {
  return Object.values(tools).map(tool => tool.execute({}))
}

async function* streamAgentResponse({
  messages,
  context,
  abortSignal,
}: ChatModelRunOptions) {
  const chatAgent = new ChatAgent()
  const providerModel = context.config?.modelName?.split('/', 2)
  const stream = chatAgent.stream(getLangchainMessages(messages), {
    tools: getLangchainTools(
      (context.tools as Record<string, JBTool['tool']>) || {},
    ),
    systemPrompt: context.system,
    provider: providerModel?.[0],
    model: providerModel?.[1],
    apiKey: context.config?.apiKey,
    baseUrl: context.config?.baseUrl,
    abortSignal,
  })
  let text = ''
  let reasoning = ''
  const tool_calls: Record<string, ToolCallMessagePart | undefined> = {}
  for await (const part of stream) {
    if (isBaseMessage(part)) {
      if (isAIMessageChunk(part)) {
        // Collect agent response and reasoning text
        text += part.text
        reasoning += (part.additional_kwargs?.reasoning_content as string) ?? ''
      } else if (isToolMessage(part)) {
        // Collect completed tool call results
        tool_calls[part.tool_call_id] = {
          type: 'tool-call',
          toolCallId: part.tool_call_id,
          toolName: part.name ?? 'UnnamedTool',
          args: tool_calls?.[part.tool_call_id]?.args ?? {},
          argsText: tool_calls?.[part.tool_call_id]?.argsText ?? '',
          result: part.content,
          isError: part.status === 'error',
          artifact: part.artifact,
        }
      } else {
        continue
      }
    } else if (part.agent) {
      for (const message of part.agent?.messages ?? []) {
        if (isAIMessage(message)) {
          // Collect initial tool call info from completed AIMessage
          message.tool_calls
            ?.filter(tool_call => tool_call.id)
            .forEach((tool_call, i) => {
              tool_calls[tool_call.id!] = {
                type: 'tool-call',
                toolCallId: tool_call.id!,
                toolName: tool_call.name,
                args: tool_call.args,
                argsText:
                  (message as AIMessageChunk)?.tool_call_chunks?.[i].args ??
                  JSON.stringify(tool_call.args),
              }
            })
        }
      }
    } else {
      continue
    }
    yield {
      content: [
        ...(reasoning && [{ type: 'reasoning', text: reasoning }]),
        ...Object.values(tool_calls),
        { type: 'text', text },
      ],
      status: { type: 'running' },
    } as ChatModelRunResult
  }
  return
}

/**
 * LocalLangchainAdapter bridges Assistant UI with LangChain.js
 */
export class LocalLangchainAdapter implements ChatModelAdapter {
  async *run(options: ChatModelRunOptions) {
    try {
      yield* streamAgentResponse(options)
    } catch (error) {
      if (error instanceof Error) {
        if (
          error.name === 'AbortError' ||
          error.message === 'Abort' ||
          error.message === 'Aborted'
        ) {
          yield {
            status: { type: 'incomplete', reason: 'cancelled' },
          } as ChatModelRunResult
          return
        } else {
          console.error(error)
          yield {
            status: {
              type: 'incomplete',
              reason: 'error',
              error: error.message,
            },
          } as ChatModelRunResult
          return
        }
      } else {
        console.error(error)
        yield {
          status: {
            type: 'incomplete',
            reason: 'error',
            error: 'An unknown error occurred, see the console for details.',
          },
        } as ChatModelRunResult
        return
      }
    }
    yield {
      status: { type: 'complete', reason: 'stop' },
    } as ChatModelRunResult
  }
}
