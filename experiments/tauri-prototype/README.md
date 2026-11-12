# Daymark Tauri prototype

This is an experimental Windows build, not a replacement for the released Electron application. It uses the separate `com.daymark.prototype` application identifier and does not read, write, or migrate the existing Daymark data.

The current interface is only for testing task storage and background reminders. The existing Daymark interface, settings, drawer mode, and installer have not yet been migrated. Use test tasks only.

- Closing the main window hides it; the tray icon restores it, and the tray menu exits the prototype.
- Test tasks are stored as numbered snapshots in the prototype's application data directory. A corrupt latest snapshot causes a startup error instead of silently replacing data. Snapshots are retained during development and therefore accumulate.
- A native background thread checks saved reminder times approximately every five seconds while the process is running. A due reminder remains pending until confirmed; confirmation is saved before the window closes. This does not guarantee delivery while the computer is asleep or the application is stopped.
- Incomplete tasks are rolled over when the prototype interface starts, regains focus, or observes a new date. Completed tasks remain on their original date.

The `Tauri prototype check` workflow builds a debug test executable and runs the isolated model and storage tests on Windows. It is a development artifact, not a public release or installer.
