import {
  AssistantToolUI,
  makeAssistantToolUI,
  tool,
  ToolCallMessagePartComponent,
} from '@assistant-ui/react'
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager'
import {
  ToolInputSchemaInputType,
  ToolInputSchemaOutputType,
  ToolRunnableConfig,
} from '@langchain/core/dist/tools/types'
import { ToolCall } from '@langchain/core/messages'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { LangGraphRunnableConfig, NodeInterrupt } from '@langchain/langgraph'
import { useWebMCP } from '@mcp-b/react-webmcp'
import { Tool } from 'assistant-stream/dist/core/tool/tool-types'
import { HITLRequest, InterruptOnConfig } from 'langchain'
import React, { createElement } from 'react'
import z from 'zod'

export const EmptySchema = z.strictObject({})
type Empty = z.infer<typeof EmptySchema>

function normalizeNulls(value: unknown): unknown {
  if (value === null) {
    return undefined
  }
  if (Array.isArray(value)) {
    return value
      .map(normalizeNulls)
      .filter(
        (entry): entry is Exclude<unknown, undefined> => entry !== undefined,
      )
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, normalizeNulls(v)]),
    )
  }
  return value
}

export class JBTool<
  FactoryArgsT = unknown,
  InputSchemaT extends z.ZodObject = z.ZodObject,
  OutputT = unknown,
  InputT = ToolInputSchemaOutputType<InputSchemaT> & Record<string, unknown>,
> {
  readonly name: string
  readonly tool: Tool<
    Empty,
    DynamicStructuredTool<
      InputSchemaT,
      InputT,
      ToolInputSchemaInputType<InputSchemaT>,
      OutputT
    >
  >
  readonly ui?: AssistantToolUI
  readonly mcp: () => React.JSX.Element
  readonly interrupt?: InterruptOnConfig

  constructor(
    {
      name,
      description,
      schema,
      factory_fn,
      render,
      interrupt,
    }: {
      name: string
      description: string
      schema: InputSchemaT
      factory_fn: (
        args: FactoryArgsT,
      ) => (
        input: InputT,
        runManager?: CallbackManagerForToolRun,
        config?: ToolRunnableConfig & LangGraphRunnableConfig,
      ) => Promise<OutputT>
      render?: ToolCallMessagePartComponent<InputT, OutputT>
      interrupt?: InterruptOnConfig & { description?: string }
    },
    args: FactoryArgsT,
  ) {
    this.name = name
    this.interrupt = interrupt

    // Tool-calling models often emit null for optional fields; normalize globally.
    const runtimeSchema = z.preprocess(
      normalizeNulls,
      schema,
    ) as unknown as InputSchemaT

    this.tool = tool({
      description,
      parameters: EmptySchema,
      execute: ({}) =>
        new DynamicStructuredTool({
          name,
          description,
          schema: runtimeSchema,
          func: (input, runManager, config) => {
            if (interrupt && config) {
              const toolCall = (config as ToolRunnableConfig).toolCall!
              const hitlRequest: HITLRequest & { toolCall: ToolCall } = {
                actionRequests: [
                  {
                    name,
                    args: input as Record<string, unknown>,
                    ...interrupt,
                  },
                ],
                reviewConfigs: [
                  {
                    actionName: name,
                    ...interrupt,
                  },
                ],
                toolCall,
              }
              throw new NodeInterrupt(hitlRequest)
            }
            return factory_fn(args)(input, runManager, config)
          },
        }),
    })
    if (render) {
      this.ui = makeAssistantToolUI<InputT, OutputT>({
        toolName: name,
        render: toolCall => createElement(render, { ...toolCall }),
      })
    }
    this.mcp = function MCPTool() {
      useWebMCP({
        name,
        description,
        inputSchema: schema.toJSONSchema(),
        handler: input => factory_fn(args)(input as InputT),
      })
      return <></>
    }
  }
}

export function createTool<
  FactoryArgsT,
  InputSchemaT extends z.ZodObject,
  OutputT,
  InputT extends Record<
    string,
    unknown
  > = ToolInputSchemaOutputType<InputSchemaT> & Record<string, unknown>,
>(create_args: {
  name: string
  description: string
  schema: InputSchemaT
  factory_fn: (
    args: FactoryArgsT,
  ) => (
    input: InputT,
    runManager?: CallbackManagerForToolRun,
    config?: ToolRunnableConfig & LangGraphRunnableConfig,
  ) => Promise<OutputT>
  render?: ToolCallMessagePartComponent<InputT, OutputT>
  interrupt?: InterruptOnConfig & { description?: string }
}) {
  return (factory_args: FactoryArgsT) => new JBTool(create_args, factory_args)
}
