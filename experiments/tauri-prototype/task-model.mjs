// Pure task operations for the isolated Tauri experiment. No user files are accessed here.
export function addTasks(tasks, texts, date, createId, now = Date.now()) {
  const clean = texts.map((text) => text.trim()).filter(Boolean)
  let nextOrder = tasks.reduce((max, task) => task.date === date ? Math.max(max, task.order) : max, -1) + 1
  return [...tasks, ...clean.map((text) => ({ id: createId(), text, done: false, date, createdAt: now, order: nextOrder++ }))]
}

export function rolloverIncomplete(tasks, today) {
  const overdue = tasks.filter((task) => !task.done && task.date < today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order)
  if (!overdue.length) return tasks
  const orders = new Map()
  let nextOrder = tasks.reduce((max, task) => task.date === today ? Math.max(max, task.order) : max, -1) + 1
  for (const task of overdue) orders.set(task.id, nextOrder++)
  return tasks.map((task) => orders.has(task.id) ? { ...task, date: today, order: orders.get(task.id) } : task)
}
