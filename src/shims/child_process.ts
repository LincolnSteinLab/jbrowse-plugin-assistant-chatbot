import type * as NodeChildProcessModule from 'node:child_process'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const spawn = (command => {}) as typeof NodeChildProcessModule.spawn

export default { spawn } as typeof NodeChildProcessModule
