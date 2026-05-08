import PluginManager from '@jbrowse/core/PluginManager'
import { AbstractSessionModel } from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import React, { useMemo } from 'react'

import { getTools } from '../tools'

export const McpProvider = observer(function ({
  pluginManager,
  session,
}: {
  pluginManager: PluginManager
  session?: AbstractSessionModel
}) {
  if (!session) return <></>
  const tools = useMemo(
    () => getTools(pluginManager, session),
    [pluginManager, session],
  )
  return (
    <>
      {Object.entries(tools)
        .filter(([, v]) => v.mcp)
        .map(([k, v]) => {
          const ToolMCP = v.mcp!
          return <ToolMCP key={k} />
        })}
    </>
  )
})
