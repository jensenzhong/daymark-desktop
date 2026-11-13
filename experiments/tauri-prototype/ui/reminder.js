const dismiss = document.getElementById('dismiss')
const errorMessage = document.getElementById('error')
dismiss.disabled = true
Promise.all([window.__TAURI__.core.invoke('get_active_reminder'), window.__TAURI__.core.invoke('get_settings')]).then(([todo, settings]) => {
  const chinese = settings?.language === 'zh'
  document.documentElement.lang = chinese ? 'zh-CN' : 'en'
  document.getElementById('label').textContent = chinese ? 'DAYMARK 提醒' : 'DAYMARK REMINDER'
  document.getElementById('heading').textContent = chinese ? '时间到了' : "It's time"
  dismiss.textContent = chinese ? '知道了' : 'Confirm'
  document.getElementById('message').textContent = todo?.text ?? (chinese ? '后台提醒已触发。' : 'Background reminder triggered.')
  if (todo?.reminderAt) document.getElementById('time').textContent = new Date(todo.reminderAt).toLocaleString(chinese ? 'zh-CN' : 'en-US')
  dismiss.disabled = false
  dismiss.addEventListener('click', async () => {
    try { await window.__TAURI__.core.invoke(todo ? 'confirm_reminder' : 'dismiss_test_reminder') }
    catch (error) { errorMessage.textContent = `关闭失败：${error}` }
  })
}).catch((error) => { errorMessage.textContent = `无法读取提醒：${error}` })
