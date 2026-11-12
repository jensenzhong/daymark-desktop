const button = document.getElementById('test-reminder')
const status = document.getElementById('status')
button.addEventListener('click', async () => {
  try {
    await window.__TAURI__.core.invoke('schedule_test_reminder')
    status.textContent = '测试提醒已设置，可关闭窗口来测试后台运行。'
  } catch (error) {
    status.textContent = `无法设置测试提醒：${error}`
  }
})
