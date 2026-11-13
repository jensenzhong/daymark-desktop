# Daymark Tauri prototype

This is an experimental Windows build, not a replacement for the released Electron application. It uses the separate `com.daymark.prototype` application identifier and does not read, write, or migrate the existing Daymark data.

The prototype reuses the Daymark interface and includes experimental window, drawer, tray, settings, task, and reminder implementations. It is still undergoing Windows interaction and long-running tests; use test tasks only and keep the Electron version installed.

- Closing the main window hides it; the tray icon restores it, and the tray menu exits the prototype.
- Test tasks are stored as numbered snapshots in the prototype's application data directory. A corrupt latest snapshot causes a startup error instead of silently replacing data. Ten recent snapshots are retained as recovery points.
- A native background thread checks saved reminder times approximately every five seconds while the process is running. A due reminder remains pending until confirmed; confirmation is saved before the window closes. This does not guarantee delivery while the computer is asleep or the application is stopped.
- Incomplete tasks are rolled over when the prototype interface starts, regains focus, or observes a new date. Completed tasks remain on their original date.

The `Tauri prototype check` workflow builds a debug executable, runs isolated model and storage tests, and creates a Windows NSIS preview installer as a GitHub Actions artifact. It is not a public release. If WebView2 is absent, the installer attempts to download it automatically and needs an internet connection.
