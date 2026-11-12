document.getElementById('dismiss').addEventListener('click', async () => {
  try { await window.__TAURI__.core.invoke('dismiss_test_reminder') }
  catch (error) { document.getElementById('error').textContent = `关闭失败：${error}` }
})
