import test from 'node:test'
import assert from 'node:assert/strict'
import { addTasks, rolloverIncomplete } from './task-model.mjs'

test('batch tasks follow the largest existing order', () => {
  let id = 0
  const tasks = [{ id: 'old', text: 'old', date: '2026-11-11', order: 4, done: false }]
  const result = addTasks(tasks, [' first ', '', 'second'], '2026-11-11', () => String(++id), 123)
  assert.deepEqual(result.map((task) => task.order), [4, 5, 6])
  assert.deepEqual(result.map((task) => task.text), ['old', 'first', 'second'])
  assert.equal(tasks.length, 1)
})

test('rollover preserves completed tasks and reminder timestamps', () => {
  const tasks = [
    { id: 'a', date: '2026-11-10', order: 0, done: false, reminderAt: 99 },
    { id: 'b', date: '2026-11-10', order: 1, done: true },
    { id: 'c', date: '2026-11-11', order: 2, done: false }
  ]
  const result = rolloverIncomplete(tasks, '2026-11-11')
  assert.equal(result[0].date, '2026-11-11')
  assert.equal(result[0].order, 3)
  assert.equal(result[0].reminderAt, 99)
  assert.equal(result[1].date, '2026-11-10')
  assert.equal(tasks[0].date, '2026-11-10')
})
