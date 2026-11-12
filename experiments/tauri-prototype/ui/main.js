const button = document.getElementById('test-reminder')
const status = document.getElementById('status')
const taskList = document.getElementById('tasks')
const taskInput = document.getElementById('task-text')
let tasks = []
function localDate(now = new Date()) {
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-')
}

function renderTasks() {
  taskList.replaceChildren()
  for (const todo of tasks) {
    const item = document.createElement('li')
    const label = document.createElement('label')
    const checkbox = document.createElement('input')
    const text = document.createElement('span')
    checkbox.type = 'checkbox'
    checkbox.checked = todo.done
    checkbox.addEventListener('change', async () => {
      try {
        tasks = await window.__TAURI__.core.invoke('toggle_task', { id: todo.id })
        renderTasks()
      } catch (error) { checkbox.checked = todo.done; status.textContent = `保存失败：${error}` }
    })
    text.textContent = todo.text
    label.append(checkbox, text)
    item.append(label)
    taskList.append(item)
  }
}

document.getElementById('task-form').addEventListener('submit', async (event) => {
  event.preventDefault()
  const text = taskInput.value.trim()
  if (!text) return
  const now = new Date()
  const date = localDate(now)
  const reminderInput = document.getElementById('task-reminder')
  const reminderAt = reminderInput.value ? new Date(reminderInput.value).getTime() : null
  if (reminderAt !== null && !Number.isFinite(reminderAt)) { status.textContent = '提醒时间无效。'; return }
  const todo = { id: crypto.randomUUID(), text, date, done: false, createdAt: now.getTime(), order: tasks.length, reminderAt }
  try {
    tasks = await window.__TAURI__.core.invoke('add_task', { todo })
    taskInput.value = ''
    reminderInput.value = ''
    status.textContent = '测试待办已保存。'
    renderTasks()
  } catch (error) { status.textContent = `保存失败：${error}` }
})

let lastRolledDate = ''
async function checkRollover() {
  const today = localDate()
  if (today === lastRolledDate) return
  try {
    tasks = await window.__TAURI__.core.invoke('rollover_tasks', { today })
    lastRolledDate = today
    renderTasks()
  } catch (error) { status.textContent = `无法读取测试数据：${error}` }
}
checkRollover()
setInterval(checkRollover, 60_000)
window.addEventListener('focus', checkRollover)

button.addEventListener('click', async () => {
  try {
    await window.__TAURI__.core.invoke('schedule_test_reminder')
    status.textContent = '测试提醒已设置，可关闭窗口来测试后台运行。'
  } catch (error) {
    status.textContent = `无法设置测试提醒：${error}`
  }
})
