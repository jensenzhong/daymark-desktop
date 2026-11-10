const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const source = fs.readFileSync(path.join(__dirname, '../src/main/store.ts'), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText

function fixture(t, filesystem = fs) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'daymark-store-test-'))
  t.after(() => {
    const expected = path.join(os.tmpdir(), 'daymark-store-test-')
    if (!root.startsWith(expected)) throw new Error('Unsafe test cleanup path')
    fs.rmSync(root, { recursive: true, force: true })
  })
  const warnings = []
  const electron = { app: { getPath: () => root }, dialog: { showErrorBox: (...args) => warnings.push(args) } }
  const exports = {}
  vm.runInNewContext(compiled, {
    exports, require: (id) => id === 'electron' ? electron
      : id === 'fs' ? filesystem
      : id === '../shared/themePresets' ? { THEME_PRESETS: [{}], DEFAULT_THEME_ID: 'test' }
        : require(id),
    console
  })
  return { store: exports, root, warnings, file: path.join(root, 'todos.json') }
}

test('batch insert preserves ordering after deletion and creates a backup', (t) => {
  const { store, file } = fixture(t)
  const date = '2026-11-10'
  let todos = store.addTodos(['one', 'two', 'three'], date)
  store.deleteTodo(todos[0].id)
  store.deleteTodo(todos[1].id)
  todos = store.addTodos(['four', 'five'], date)
  assert.deepEqual(Array.from(todos, (item) => item.order), [2, 3, 4])
  assert.deepEqual(Array.from(todos, (item) => item.text), ['three', 'four', 'five'])
  assert.equal(JSON.parse(fs.readFileSync(file + '.bak', 'utf8')).length, 1)
})

test('failed replacement preserves the existing task file', (t) => {
  let failReplacement = false
  const filesystem = { ...fs, renameSync: (from, to) => {
    if (failReplacement && to.endsWith('todos.json')) throw new Error('simulated write failure')
    return fs.renameSync(from, to)
  } }
  const { store, file, warnings } = fixture(t, filesystem)
  store.addTodo('safe', '2026-11-10')
  const original = fs.readFileSync(file, 'utf8')
  failReplacement = true
  assert.throws(() => store.addTodo('not saved', '2026-11-10'))
  assert.equal(fs.readFileSync(file, 'utf8'), original)
  assert.equal(warnings.length, 1)
})

test('corrupt or missing primary data is never silently overwritten', (t) => {
  const { store, file, warnings } = fixture(t)
  fs.writeFileSync(file, '{invalid')
  assert.throws(() => store.addTodo('must not overwrite', '2026-11-10'))
  assert.equal(fs.readFileSync(file, 'utf8'), '{invalid')
  assert.equal(warnings.length, 1)
  fs.writeFileSync(file + '.bak', '[]')
  fs.unlinkSync(file)
  assert.throws(() => store.addTodo('must not overwrite', '2026-11-10'))
  assert.equal(fs.existsSync(file), false)
  assert.equal(fs.readFileSync(file + '.bak', 'utf8'), '[]')
})

test('rollover moves only incomplete past tasks and preserves reminders', (t) => {
  const { store } = fixture(t)
  let todos = store.addTodos(['unfinished', 'completed'], '2026-11-09')
  store.updateTodo(todos[0].id, { reminderAt: 123456789 })
  store.toggleTodoDone(todos[1].id)
  todos = store.rolloverIncompleteTodos('2026-11-10')
  assert.equal(todos[0].date, '2026-11-10')
  assert.equal(todos[0].reminderAt, 123456789)
  assert.equal(todos[1].date, '2026-11-09')
  assert.equal(todos[1].done, true)
})
