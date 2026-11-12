const dismiss = document.getElementById('dismiss')
const errorMessage = document.getElementById('error')
dismiss.disabled = true
window.__TAURI__.core.invoke('get_active_reminder').then((todo) => {
  if (todo) document.getElementById('message').textContent = todo.text
  dismiss.disabled = false
  dismiss.addEventListener('click', async () => {
    try { await window.__TAURI__.core.invoke(todo ? 'confirm_reminder' : 'dismiss_test_reminder') }
    catch (error) { errorMessage.textContent = `关闭失败：${error}` }
  })
}).catch((error) => { errorMessage.textContent = `无法读取提醒：${error}` })
