# JBrowse Copilot / WebMCP Plugin

Agentic AI interfaces for JBrowse:
- AI chat in a sidebar widget.
- Exposing JBrowse functionality as WebMCP tools.

## Usage

### Software requirements

- [git](https://git-scm.com/downloads)
- [Node.js](https://nodejs.org/en/download/) (version 24)
- [JBrowse](https://github.com/gmod/jbrowse-components) (version 4.0 or
  greater)

## Getting started

### Setup

Run `npm install` to
install the necessary dependencies.

After this, run `npm run setup`. This configures your project,
and adds a build of JBrowse 2 that can be used to test your plugin during
development.

### Build

```console
$ npm run build
```

### Development

To develop against JBrowse Web:

- Start a development version of JBrowse Web (see
  [here](https://github.com/GMOD/jbrowse-components/blob/master/CONTRIBUTING.md))
- In this project, run `npm run start`
- Assuming JBrowse Web is being served on port 3000, navigate in your web
  browser to
  http://localhost:3000/?config=http://localhost:9000/jbrowse_config.json
- When you make changes to your plugin, it will automatically be re-built. You
  can then refresh JBrowse Web to see the changes.

Alternatively, download a [JBrowse development build](https://github.com/GFJHogue/jbrowse2-development-builds/releases), replace `.jbrowse/` with its contents, and run `npm run develop`.

### Testing

#### `npm run browse`

Launches your local JBrowse 2 build that is used for integration testing, with
your plugin already included in the configuration. Your plugin must also be
running (`npm run start`). Alternatively, `npm run develop` will run both commands in parallel.

## Tools and WebMCP

This plugin exposes JBrowse functionality through a set of tools that are
available to both the AI chat agent and as
[WebMCP](https://github.com/mcp-b/mcp-b) tools. WebMCP tools are registered
automatically in the browser when the plugin is loaded, making JBrowse
controllable by any MCP-compatible AI client running on the same page.

### Defining New Tools

All tools are created with `createTool()` from
`src/JBrowseAssistant/tools/base.tsx`. Each tool defined this way is
automatically available to the chat agent **and** registered as a WebMCP tool —
no extra wiring is needed.

#### Signature

```ts
createTool<FactoryArgsT, InputSchemaT, OutputT>({
  name: string           // unique tool name exposed to the LLM and WebMCP
  description: string    // natural-language description used for tool selection
  schema: InputSchemaT   // Zod object schema for the tool's inputs
  factory_fn: (          // curried function: captures runtime deps, returns the executor
    args: FactoryArgsT,
    context?: ToolExecHumanContext,
  ) => (input: InputT) => Promise<OutputT>
  render?: ToolCallMessagePartComponent<InputT, OutputT>  // optional chat UI
})
```

`createTool()` returns a **factory function** — call it with the runtime
dependencies your tool needs (`FactoryArgsT`) and it returns a `JBTool`
instance. Add the result to the object returned by `getTools()` in
`src/JBrowseAssistant/tools/index.ts` to register it.

#### Example: a simple read-only tool

Tools that only need to read session state and take no inputs use the exported
`EmptySchema` constant.

```ts
import { createTool, EmptySchema } from './base'

export const MyTool = createTool({
  name: 'MyTool',
  description: 'Return something useful from the JBrowse session',
  schema: EmptySchema,
  factory_fn: (myDep: MyDepType) => async ({}) => {
    return JSON.stringify(myDep)
  },
})
```

Register it by passing a runtime value to the factory:

```ts
// in getTools()
myTool: MyTool(session.someValue),
```

#### Example: a tool with inputs

Use a Zod schema to declare typed inputs. Each field's `.describe()` string
is passed to the LLM to guide argument selection.

```ts
import { z } from 'zod'
import { createTool } from './base'

export const MyInputTool = createTool({
  name: 'MyInputTool',
  description: 'Do something with a user-provided value',
  schema: z.object({
    target: z.string().describe('The thing to act on'),
  }),
  factory_fn: (dep: DepType) => async ({ target }) => {
    return dep.doSomething(target)
  },
})
```

#### Example: a tool with human-in-the-loop confirmation

If your tool performs a destructive or side-effecting action, use
`context.human()` to pause execution and ask the user to confirm. The `render`
field provides the React component shown in the chat thread during the
interruption. `resume(true)` approves the action; `resume(false)` cancels it.

```ts
import { createTool } from './base'
import { z } from 'zod'

export const MyConfirmedTool = createTool({
  name: 'MyConfirmedTool',
  description: 'Perform a side-effecting action after user approval',
  schema: z.object({ target: z.string() }),
  factory_fn: (dep: DepType, context) => async ({ target }, _, config) => {
    if (context) {
      const approved = await context.human({ config, payload: target })
      if (!approved) return { result: 'skipped' }
    }
    dep.doSideEffect(target)
    return { result: 'success' }
  },
  render: ({ interrupt, resume, toolName }) => {
    if (interrupt) {
      return (
        <div>
          <p>Allow <b>{toolName}</b> to act on "{String(interrupt)}"?</p>
          <button onClick={() => resume(true)}>Approve</button>
          <button onClick={() => resume(false)}>Cancel</button>
        </div>
      )
    }
    return null
  },
})
```

> **Note:** `context` is `undefined` when the tool is invoked via WebMCP
> (there is no chat thread to display a prompt), so always guard with
> `if (context)` before calling `context.human()`.

### WebMCP

When the plugin is loaded, it automatically mounts a hidden React subtree that
registers all tools (except `ApiKeyVault`) as WebMCP tools. This allows
external MCP clients — such as AI agents running in a [browser extension](https://chromewebstore.google.com/detail/mcp-b-extension/daohopfhkdelnpemnhlekblhnikhdhfa) or
another tab on the same page — to invoke JBrowse actions without going through
the chat widget.

No additional configuration is required to enable WebMCP; it is active whenever
the plugin is installed.

## Credential Management (widget only)

API keys for LLM providers are stored in the browser using an encrypted
secrets vault backed by `localStorage`. The vault uses
[`@metamask/browser-passworder`](https://github.com/MetaMask/browser-passworder)
to AES-encrypt secrets at rest.

### How It Works

1. **First use:** When you save an API key for the first time, a master
   password is used to derive an encryption key. The encrypted vault and an
   exported key string are written to `localStorage` under the key
   `chatbot-vault`.
2. **Subsequent uses:** If the vault has already been decrypted in the current
   browser session (i.e. it is cached in memory), API keys can be retrieved
   without entering a password again. If the page is refreshed, the vault is
   locked and the master password must be re-entered before any key can be
   accessed.
3. **Password prompts:** The chat widget will display a password prompt
   whenever an API key is needed but the vault is locked. You can dismiss the
   prompt to cancel the operation.
4. **Clearing the vault:** You can remove all stored credentials at any time
   through the settings panel, which calls `localStorage.removeItem` on the
   vault entry.

### Supported Providers

| Provider | Default Model |
|----------|---------------|
| OpenAI | `gpt-4o-mini` |
| Anthropic | `claude-3-5-haiku-latest` |
| Google Gemini | `gemini-2.5-flash-lite` |
| Ollama (local) | `qwen3:0.6b` |

Ollama runs locally and does not require an API key. For all other providers,
enter your API key in the **Settings** panel of the chat widget. Settings
(provider choice, model, system prompt, temperature) are stored unencrypted in
`localStorage` under the key `chatbot-settings`; only API keys are encrypted.
