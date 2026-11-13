#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod storage;
mod desktop;

use std::sync::{atomic::{AtomicBool, Ordering}, Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{menu::{Menu, MenuItem}, tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent}, Manager, State, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use storage::{Data, Storage, Todo};

struct Tasks(Mutex<(Storage, Data)>);

fn valid_date(date: &str) -> bool {
    date.len() == 10 && date.bytes().enumerate().all(|(i, b)| if i == 4 || i == 7 { b == b'-' } else { b.is_ascii_digit() })
}

#[tauri::command]
fn get_tasks(state: State<'_, Tasks>) -> Result<Vec<Todo>, String> {
    Ok(state.0.lock().map_err(|e| e.to_string())?.1.todos.clone())
}

#[tauri::command]
fn get_settings(state: State<'_, Tasks>) -> Result<serde_json::Value, String> {
    Ok(state.0.lock().map_err(|e| e.to_string())?.1.settings.clone())
}

#[tauri::command]
fn save_settings(state: State<'_, Tasks>, settings: serde_json::Value) -> Result<serde_json::Value, String> {
    if !settings.is_object() { return Err("Invalid settings".into()); }
    let mut state = state.0.lock().map_err(|e| e.to_string())?;
    let mut data = state.1.clone();
    let mut settings = settings;
    for key in ["windowBounds", "drawerBounds"] {
        if let Some(saved) = data.settings.get(key) { settings[key] = saved.clone(); }
    }
    data.settings = settings.clone();
    state.0.save(&data).map_err(|e| e.to_string())?;
    state.1 = data;
    Ok(settings)
}

#[tauri::command]
fn rollover_tasks(state: State<'_, Tasks>, today: String) -> Result<Vec<Todo>, String> {
    if !valid_date(&today) {
        return Err("Invalid date".into());
    }
    let mut state = state.0.lock().map_err(|e| e.to_string())?;
    let mut data = state.1.clone();
    if data.rollover(&today) {
        state.0.save(&data).map_err(|e| e.to_string())?;
        state.1 = data;
    }
    Ok(state.1.todos.clone())
}

#[tauri::command]
fn add_task(state: State<'_, Tasks>, todo: Todo) -> Result<Vec<Todo>, String> {
    let mut state = state.0.lock().map_err(|e| e.to_string())?;
    let mut data = state.1.clone();
    data.append(todo).map_err(str::to_owned)?;
    state.0.save(&data).map_err(|e| e.to_string())?;
    state.1 = data;
    Ok(state.1.todos.clone())
}

#[tauri::command]
fn add_tasks(state: State<'_, Tasks>, todos: Vec<Todo>) -> Result<Vec<Todo>, String> {
    let mut state = state.0.lock().map_err(|e| e.to_string())?;
    let mut data = state.1.clone();
    data.append_batch(todos).map_err(str::to_owned)?;
    state.0.save(&data).map_err(|e| e.to_string())?;
    state.1 = data;
    Ok(state.1.todos.clone())
}

#[tauri::command]
fn toggle_task(state: State<'_, Tasks>, id: String) -> Result<Vec<Todo>, String> {
    let mut state = state.0.lock().map_err(|e| e.to_string())?;
    let mut data = state.1.clone();
    let todo = data.todos.iter_mut().find(|todo| todo.id == id).ok_or("Task not found")?;
    todo.done = !todo.done;
    if todo.done { todo.reminder_at = None; }
    state.0.save(&data).map_err(|e| e.to_string())?;
    state.1 = data;
    Ok(state.1.todos.clone())
}

#[tauri::command]
fn remove_task(state: State<'_, Tasks>, id: String) -> Result<Vec<Todo>, String> {
    let mut state = state.0.lock().map_err(|e| e.to_string())?;
    let mut data = state.1.clone();
    if !data.todos.iter().any(|todo| todo.id == id) { return Err("Task not found".into()); }
    data.todos.retain(|todo| todo.id != id);
    state.0.save(&data).map_err(|e| e.to_string())?;
    state.1 = data;
    Ok(state.1.todos.clone())
}

#[tauri::command]
fn reorder_tasks(state: State<'_, Tasks>, ids: Vec<String>) -> Result<Vec<Todo>, String> {
    let mut state = state.0.lock().map_err(|e| e.to_string())?;
    let mut data = state.1.clone();
    data.reorder(&ids).map_err(str::to_owned)?;
    state.0.save(&data).map_err(|e| e.to_string())?;
    state.1 = data;
    Ok(state.1.todos.clone())
}

#[tauri::command]
fn update_task(state: State<'_, Tasks>, id: String, patch: serde_json::Value) -> Result<Vec<Todo>, String> {
    let fields = patch.as_object().ok_or("Invalid task update")?;
    let mut state = state.0.lock().map_err(|e| e.to_string())?;
    let mut data = state.1.clone();
    let todo = data.todos.iter_mut().find(|todo| todo.id == id).ok_or("Task not found")?;
    for (key, value) in fields {
        match key.as_str() {
            "text" => {
                let text = value.as_str().ok_or("Invalid task text")?.trim();
                if text.is_empty() { return Err("Task text is empty".into()); }
                todo.text = text.to_owned();
            }
            "date" => {
                let date = value.as_str().ok_or("Invalid task date")?;
                if !valid_date(date) { return Err("Invalid task date".into()); }
                todo.date = date.to_owned();
            }
            "order" => todo.order = value.as_i64().ok_or("Invalid task order")?,
            "reminderAt" => todo.reminder_at = if value.is_null() { None } else { Some(value.as_i64().ok_or("Invalid reminder")?) },
            _ => return Err("Unsupported task update".into()),
        }
    }
    state.0.save(&data).map_err(|e| e.to_string())?;
    state.1 = data;
    Ok(state.1.todos.clone())
}

struct AlarmState {
    active: Arc<AtomicBool>,
    current: Mutex<Option<Todo>>,
}

#[tauri::command]
fn schedule_test_reminder(app: tauri::AppHandle, state: State<'_, AlarmState>) -> Result<(), String> {
    if state.active.swap(true, Ordering::SeqCst) {
        return Err("A test reminder is already scheduled".into());
    }
    let active = state.active.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(15));
        let result = WebviewWindowBuilder::new(&app, "reminder", WebviewUrl::App("reminder.html".into()))
            .title("Daymark test reminder").inner_size(340.0, 220.0).center()
            .always_on_top(true).resizable(false).build();
        match result {
            Ok(window) => { let _ = window.set_focus(); }
            Err(error) => { eprintln!("Test reminder window failed: {error}"); active.store(false, Ordering::SeqCst); }
        }
    });
    Ok(())
}

#[tauri::command]
fn dismiss_test_reminder(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("reminder") {
        window.destroy().map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn get_active_reminder(state: State<'_, AlarmState>) -> Result<Option<Todo>, String> {
    Ok(state.current.lock().map_err(|e| e.to_string())?.clone())
}

#[tauri::command]
fn confirm_reminder(app: tauri::AppHandle, alarms: State<'_, AlarmState>, tasks: State<'_, Tasks>) -> Result<(), String> {
    let shown = alarms.current.lock().map_err(|e| e.to_string())?.clone();
    if let Some(shown) = shown {
        let mut tasks = tasks.0.lock().map_err(|e| e.to_string())?;
        let mut data = tasks.1.clone();
        if data.acknowledge(&shown) {
            tasks.0.save(&data).map_err(|e| e.to_string())?;
            tasks.1 = data;
        }
    }
    let window = app.get_webview_window("reminder").ok_or("Reminder window not found")?;
    window.destroy().map_err(|e| e.to_string())
}

fn start_reminder_scheduler(app: tauri::AppHandle) {
    std::thread::spawn(move || loop {
        let now = SystemTime::now().duration_since(UNIX_EPOCH).ok()
            .and_then(|time| i64::try_from(time.as_millis()).ok());
        if let Some(now) = now {
            let tasks = app.state::<Tasks>();
            let due = tasks.0.lock().ok().and_then(|state| state.1.next_due(now));
            if let Some(todo) = due {
                let alarms = app.state::<AlarmState>();
                if !alarms.active.swap(true, Ordering::SeqCst) {
                    if let Ok(mut current) = alarms.current.lock() {
                        *current = Some(todo);
                        drop(current);
                        let result = WebviewWindowBuilder::new(&app, "reminder", WebviewUrl::App("reminder.html".into()))
                            .title("Daymark reminder").inner_size(430.0, 300.0).center()
                            .decorations(false).transparent(true).always_on_top(true).resizable(false).closable(false).build();
                        match result {
                            Ok(window) => { let _ = window.set_focus(); }
                            Err(error) => {
                                eprintln!("Reminder window failed: {error}");
                                if let Ok(mut current) = alarms.current.lock() { *current = None; }
                                alarms.active.store(false, Ordering::SeqCst);
                            }
                        }
                    } else { alarms.active.store(false, Ordering::SeqCst); };
                }
            }
        }
        // Re-check the wall clock after suspend, resume, or a clock change.
        std::thread::sleep(Duration::from_secs(5));
    });
}

fn show_main(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        desktop::mark_shown(app);
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main(app)))
        .manage(AlarmState { active: Arc::new(AtomicBool::new(false)), current: Mutex::new(None) })
        .manage(desktop::DesktopState::default())
        .invoke_handler(tauri::generate_handler![schedule_test_reminder, dismiss_test_reminder, get_active_reminder, confirm_reminder, get_tasks, get_settings, save_settings, add_task, add_tasks, toggle_task, remove_task, reorder_tasks, update_task, rollover_tasks, desktop::hide_main, desktop::quit_app, desktop::set_pinned, desktop::start_drag, desktop::set_content_height, desktop::begin_resize, desktop::resize_to, desktop::end_resize, desktop::set_display_mode])
        .setup(|app| {
            let directory = app.path().app_data_dir()?.join("prototype-tasks");
            let (storage, data) = Storage::open(directory)?;
            app.manage(Tasks(Mutex::new((storage, data))));
            desktop::create_drawer(app)?;
            desktop::restore(app.handle()).map_err(std::io::Error::other)?;
            desktop::start_drawer(app.handle().clone());
            desktop::start_bounds_saver(app.handle().clone());
            start_reminder_scheduler(app.handle().clone());
            let show = MenuItem::with_id(app, "show", "Show Daymark", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit prototype", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;
            let icon = tauri::image::Image::from_bytes(include_bytes!("../../../../build/icon.png"))?;
            TrayIconBuilder::new()
                .icon(icon)
                .tooltip("Daymark Prototype")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        show_main(tray.app_handle());
                    }
                })
                .build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" {
              if matches!(event, WindowEvent::Moved(_) | WindowEvent::Resized(_)) { desktop::mark_bounds_changed(window.app_handle()); }
              if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
              }
            } else if window.label() == "reminder" && matches!(event, WindowEvent::Destroyed) {
                let state = window.state::<AlarmState>();
                if let Ok(mut current) = state.current.lock() { *current = None; }
                state.active.store(false, Ordering::SeqCst);
            }
        })
        .run(tauri::generate_context!())
        .expect("failed to run Daymark prototype");
}
