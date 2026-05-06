import {
  ChatModelAdapter,
  ChatModelRunOptions,
  ChatModelRunResult,
  MessageStatus,
  ThreadMessage,
  ToolCallMessagePart,
} from '@assistant-ui/react'
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  BaseMessageFields,
  HumanMessage,
  SystemMessage,
  ToolCall,
  ToolMessage,
} from '@langchain/core/messages'
import { Command } from '@langchain/langgraph'
import { HITLRequest } from 'langchain'

import { ChatAgent } from './agent/ChatAgent'
import { ChatModelProvider } from './agent/ChatModel'
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

async function getLangchainTools(
  tools: Record<string, JBTool['tool']>,
  abortSignal: AbortSignal,
) {
  return Promise.all(
    Object.values(tools)
      .filter(tool => tool.execute)
      .map(tool =>
        Promise.resolve(
          tool.execute!(
            {},
            {
              toolCallId: '',
              abortSignal,
              human: () => Promise.resolve(undefined),
            },
          ),
        ),
      ),
  )
}

function getThreadId(messages: readonly ThreadMessage[]) {
  return messages.find(message => message.role === 'user')?.id ?? '1'
}

function getResumePayload(messages: readonly ThreadMessage[]) {
  const lastAssistantMessage = messages.findLast(
    message => message.role === 'assistant',
  )

  if (!lastAssistantMessage) {
    return undefined
  }

  const interruptedToolCall = lastAssistantMessage.content.findLast(
    part =>
      part.type === 'tool-call' &&
      part.interrupt?.type === 'human' &&
      part.result !== undefined,
  ) as ToolCallMessagePart | undefined

  if (!interruptedToolCall) {
    return undefined
  }

  return {
    payload: interruptedToolCall.result,
    threadId: lastAssistantMessage.id,
  }
}

async function* streamAgentResponse({
  messages,
  context,
  abortSignal,
}: ChatModelRunOptions) {
  const chatAgent = new ChatAgent()
  const providerModel = context.config?.modelName?.split('/', 2)
  const { apiKeyVault, ...tools } = context.tools as Record<
    string,
    JBTool['tool']
  > & { apiKeyVault: JBTool['tool'] }
  const getApiKey = (
    await Promise.resolve(
      apiKeyVault.execute!(
        {},
        {
          toolCallId: '',
          abortSignal,
          human: () => Promise.resolve(undefined),
        },
      ),
    )
  ).func as ({}) => Promise<string | undefined>
  const resume = getResumePayload(messages)
  const stream = chatAgent.stream(
    resume
      ? new Command({ resume: resume.payload })
      : getLangchainMessages(messages),
    {
      tools: await getLangchainTools(tools, abortSignal),
      systemPrompt: context.system,
      abortSignal,
      threadId: resume?.threadId ?? getThreadId(messages),
      chatModelConfig: {
        provider: providerModel?.[0] as ChatModelProvider,
        model: providerModel?.[1],
        baseUrl: context.config?.baseUrl,
        temperature: context.callSettings?.temperature,
        getApiKey,
      },
    },
  )
  let text = ''
  let reasoning = ''
  const tool_calls: Record<string, ToolCallMessagePart> = {}
  for await (const part of stream) {
    let status: MessageStatus = { type: 'running' }
    if (BaseMessage.isInstance(part)) {
      if (AIMessageChunk.isInstance(part)) {
        // Collect agent response and reasoning text
        text += part.text
        reasoning += (part.additional_kwargs?.reasoning_content as string) ?? ''
      } else if (ToolMessage.isInstance(part)) {
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
    } else if ('agent' in part && Array.isArray(part.agent?.messages)) {
      for (const message of part.agent?.messages) {
        if (AIMessage.isInstance(message)) {
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
    } else if (
      '__interrupt__' in part &&
      Array.isArray(part.__interrupt__) &&
      part.__interrupt__[0]?.value
    ) {
      const { toolCall, ...hitlRequest } = part.__interrupt__[0]
        .value as HITLRequest & { toolCall: ToolCall }
      tool_calls[toolCall.id!] = {
        type: 'tool-call',
        toolCallId: toolCall.id!,
        toolName: toolCall.name,
        args: toolCall.args,
        argsText: JSON.stringify(toolCall.args),
        interrupt: { type: 'human', payload: hitlRequest },
      }
      status = { type: 'requires-action', reason: 'interrupt' }
    } else {
      continue
    }
    yield {
      content: [
        ...(reasoning && [{ type: 'reasoning', text: reasoning }]),
        ...Object.values(tool_calls),
        { type: 'text', text },
      ],
      status,
    } as ChatModelRunResult
  }
}

/**
 * LocalLangchainAdapter bridges Assistant UI with LangChain.js
 */
export const LocalLangchainAdapter: ChatModelAdapter = {
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
  },
}
