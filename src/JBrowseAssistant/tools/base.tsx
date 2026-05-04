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
import { DynamicStructuredTool } from '@langchain/core/tools'
import { LangGraphRunnableConfig } from '@langchain/langgraph'
import { useWebMCP } from '@mcp-b/react-webmcp'
import {
  Tool,
  ToolExecutionContext,
} from 'assistant-stream/dist/core/tool/tool-types'
import React, { createElement } from 'react'
import z from 'zod'
import { JSONType } from 'zod/dist/types/v4/core/util'

export const EmptySchema = z.strictObject({})
type Empty = z.infer<typeof EmptySchema>

type ToolExecHumanContext = Omit<ToolExecutionContext, 'human'> & {
  human: ({
    config,
    payload,
  }: {
    config?: ToolRunnableConfig & LangGraphRunnableConfig
    payload: JSONType
  }) => Promise<unknown>
}

export interface InterruptPart {
  interrupt: {
    toolCallId: string
    payload: unknown
  }
}

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
  InputSchemaT extends z.AnyZodObject = z.AnyZodObject,
  OutputT = unknown,
  InputT = ToolInputSchemaOutputType<InputSchemaT> & Record<string, unknown>,
> {
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

  private resume: (payload: unknown) => void = () => {
    throw new Error('Missing human tool resume method')
  }

  constructor(
    {
      name,
      description,
      schema,
      factory_fn,
      render,
    }: {
      name: string
      description: string
      schema: InputSchemaT
      factory_fn: (
        args: FactoryArgsT,
        context?: ToolExecHumanContext,
      ) => (
        input: InputT,
        runManager?: CallbackManagerForToolRun,
        config?: ToolRunnableConfig & LangGraphRunnableConfig,
      ) => Promise<OutputT>
      render?: ToolCallMessagePartComponent<InputT, OutputT>
    },
    args: FactoryArgsT,
  ) {
    // Tool-calling models often emit null for optional fields; normalize globally.
    const runtimeSchema = z.preprocess(
      normalizeNulls,
      schema,
    ) as unknown as InputSchemaT

    this.tool = tool({
      description,
      parameters: EmptySchema,
      execute: ({}, context) =>
        new DynamicStructuredTool({
          name,
          description,
          schema: runtimeSchema,
          func: factory_fn(args, { ...context, human: this.human }),
        }),
    })
    if (render) {
      this.ui = makeAssistantToolUI<InputT, OutputT>({
        toolName: name,
        render: toolCall =>
          createElement(render, { ...toolCall, resume: this.resume }),
      })
    }
    this.mcp = function MCPTool() {
      useWebMCP({
        name,
        description,
        inputSchema: schema.shape,
        handler: input => factory_fn(args)(input as InputT),
      })
      return <></>
    }
  }

  human: ToolExecHumanContext['human'] = ({ config, payload }) => {
    if (!config?.writer) throw new Error("Couldn't emit LangGraph event")
    if (!config.toolCall?.id) throw new Error('Missing tool call ID')
    config.writer({
      interrupt: { toolCallId: config.toolCall.id, payload },
    } as InterruptPart)
    return new Promise(resolve => {
      this.resume = resolve
    })
  }
}

export function createTool<
  FactoryArgsT,
  InputSchemaT extends z.AnyZodObject,
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
    context?: ToolExecHumanContext,
  ) => (
    input: InputT,
    runManager?: CallbackManagerForToolRun,
    config?: ToolRunnableConfig & LangGraphRunnableConfig,
  ) => Promise<OutputT>
  render?: ToolCallMessagePartComponent<InputT, OutputT>
}) {
  return (factory_args: FactoryArgsT) => new JBTool(create_args, factory_args)
}
