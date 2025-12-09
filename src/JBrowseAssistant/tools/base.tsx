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

  private resume: (payload: unknown) => void = () => {
    throw new Error('Missing human tool resume method')
  }
  mcp: () => React.JSX.Element

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
    this.tool = tool({
      description,
      parameters: EmptySchema,
      execute: ({}, context) =>
        new DynamicStructuredTool({
          name,
          description,
          schema,
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
>(
  create_args: ConstructorParameters<
    typeof JBTool<FactoryArgsT, InputSchemaT, OutputT, InputT>
  >[0],
) {
  return (factory_args: FactoryArgsT) => new JBTool(create_args, factory_args)
}
