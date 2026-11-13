import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { runInNewContext } from 'node:vm'
import { randomUUID } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const directory = dirname(fileURLToPath(import.meta.url))
const bundle = await build({ entryPoints: [resolve(directory, 'tauri-api.ts')], bundle: true, write: false, format: 'cjs', platform: 'node' })

function createBridge() {
  const calls = []
  const listeners = new Map()
  let settings = null
  let todos = []
  const win = {
    __TAURI__: {
      core: { invoke: async (command, args) => {
        calls.push({ command, args })
        if (command === 'get_settings') return settings
        if (command === 'save_settings') return settings = args.settings
        if (command === 'rollover_tasks' || command === 'get_tasks') return todos
        if (command === 'add_tasks') { todos = [...todos, ...args.todos]; return todos }
        if (command === 'add_task') { todos = [...todos, args.todo]; return todos }
        return undefined
      } },
      event: { listen: async () => () => {} }
    },
    addEventListener: (name, handler) => listeners.set(name, handler)
  }
  const module = { exports: {} }
  const document = { addEventListener() {} }
  const context = { module, exports: module.exports, window: win, document, setInterval() {}, crypto: { randomUUID }, console, Date, Promise }
  runInNewContext(bundle.outputFiles[0].text, context)
  module.exports.installTauriApi()
  return { api: win.api, calls, listeners }
}

test('bridge sends a whole pasted batch and keeps settings in the isolated backend', async () => {
  const { api, calls } = createBridge()
  const defaults = await api.settings.get()
  assert.equal(defaults.language, 'en')
  const selected = await api.settings.setLanguage('zh')
  assert.equal(selected.language, 'zh')
  const tasks = await api.todos.addMany(['first', 'second'], '2026-11-13')
  assert.equal(tasks.length, 2)
  assert.notEqual(tasks[0].id, tasks[1].id)
  assert.deepEqual(calls.filter((call) => call.command === 'add_tasks').map((call) => call.args.todos.length), [2])
})

test('a width-only resize preserves height following, while height changes disable it', async () => {
  const { api, calls } = createBridge()
  await api.settings.get()
  api.window.beginResize(100, 100)
  api.window.resizeTo(140, 100)
  api.window.endResize()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(calls.some((call) => call.command === 'save_settings'), false)
  api.window.beginResize(100, 100)
  api.window.resizeTo(100, 140)
  api.window.endResize()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(calls.find((call) => call.command === 'save_settings')?.args.settings.autoHeight, false)
})
