const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

test('reminders schedule efficiently, queue, and recover after resume', () => {
  let now = 1_000_000, nextId = 0, todos = [], reads = 0, changed, resume
  const timers = new Map(), windows = []
  class FakeWindow {
    constructor() { this.destroyed = false; this.listeners = {}; windows.push(this) }
    setAlwaysOnTop() {} setVisibleOnAllWorkspaces() {} once() {} loadFile() {} loadURL() {}
    on(event, fn) { this.listeners[event] = fn }
    isDestroyed() { return this.destroyed }
    destroy() { this.destroyed = true; this.listeners.closed?.() }
  }
  const electron = {
    BrowserWindow: FakeWindow,
    screen: { getCursorScreenPoint: () => ({ x: 0, y: 0 }), getDisplayNearestPoint: () => ({ workArea: { x: 0, y: 0, width: 1000, height: 800 } }) },
    powerMonitor: { on: (event, fn) => { if (event === 'resume') resume = fn } }
  }
  const store = { readTodos: () => { reads++; return todos }, onTodosChanged: (fn) => { changed = fn } }
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/main/reminders.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText
  const exports = {}
  vm.runInNewContext(code, {
    exports, __dirname, process: { env: {} },
    require: (id) => id === 'electron' ? electron : id === './store' ? store : id === './icon' ? { getIconPath: () => '' } : require(id),
    Date: class extends Date { static now() { return now } },
    setTimeout: (fn, ms) => { const id = ++nextId; timers.set(id, { fn, ms }); return id },
    clearTimeout: (id) => timers.delete(id)
  })
  exports.startReminderScheduler()
  assert.equal(timers.size, 0)
  todos = [{ id: 'a', text: 'one', done: false, reminderAt: now + 5000 }, { id: 'b', text: 'two', done: false, reminderAt: now + 5000 }]
  changed(todos)
  assert.equal(reads, 1)
  assert.equal([...timers.values()][0].ms, 5000)
  now += 5000
  const [timerId, timer] = [...timers.entries()][0]
  timers.delete(timerId)
  timer.fn()
  assert.equal(windows.length, 1)
  todos[0].reminderAt = null
  changed(todos)
  assert.equal(windows.length, 1)
  exports.dismissActiveReminder('a')
  assert.equal(windows.length, 2)
  todos[1].reminderAt = null
  changed(todos)
  exports.dismissActiveReminder('b')
  assert.equal(timers.size, 0)
  todos = [{ id: 'c', text: 'later', done: false, reminderAt: now + 3_600_000 }]
  changed(todos)
  assert.equal([...timers.values()][0].ms, 60_000)
  now += 3_600_000
  resume()
  assert.equal(windows.length, 3)
})
