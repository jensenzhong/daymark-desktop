use std::sync::{atomic::{AtomicBool, AtomicU64, Ordering}, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, State, WebviewWindow, WebviewWindowBuilder, WebviewUrl};
use crate::Tasks;

struct ResizeStart { x: f64, y: f64, width: u32, height: u32, scale: f64 }
pub struct DesktopState {
    resize: Mutex<Option<ResizeStart>>,
    drawer: AtomicBool,
    grace: Mutex<Instant>,
    bounds_revision: AtomicU64,
}
impl Default for DesktopState {
    fn default() -> Self { Self { resize: Mutex::new(None), drawer: AtomicBool::new(false), grace: Mutex::new(Instant::now()), bounds_revision: AtomicU64::new(0) } }
}

fn main_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    app.get_webview_window("main").ok_or_else(|| "Main window not found".to_owned())
}

#[tauri::command]
pub fn hide_main(app: AppHandle) -> Result<(), String> { main_window(&app)?.hide().map_err(|e| e.to_string()) }

#[tauri::command]
pub fn quit_app(app: AppHandle) { app.exit(0); }

#[tauri::command]
pub fn set_pinned(app: AppHandle, state: State<'_, DesktopState>, pinned: bool) -> Result<(), String> {
    main_window(&app)?.set_always_on_top(pinned || state.drawer.load(Ordering::SeqCst)).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn start_drag(app: AppHandle) -> Result<(), String> { main_window(&app)?.start_dragging().map_err(|e| e.to_string()) }

#[tauri::command]
pub fn set_content_height(app: AppHandle, height: f64) -> Result<(), String> {
    if !height.is_finite() { return Err("Invalid height".into()); }
    let window = main_window(&app)?;
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let size = window.inner_size().map_err(|e| e.to_string())?;
    let monitor = window.current_monitor().map_err(|e| e.to_string())?;
    let max_height = monitor.as_ref().map(|m| m.work_area().size.height).unwrap_or(2160);
    let target = ((height.max(140.0) * scale).round() as u32).min(max_height);
    if size.height.abs_diff(target) > 2 {
        window.set_size(PhysicalSize::new(size.width, target)).map_err(|e| e.to_string())?;
        if let (Some(monitor), Ok(position)) = (monitor, window.outer_position()) {
            let area = monitor.work_area();
            let max_y = area.position.y.saturating_add(area.size.height.saturating_sub(target) as i32);
            let y = position.y.clamp(area.position.y, max_y);
            if y != position.y { window.set_position(PhysicalPosition::new(position.x, y)).map_err(|e| e.to_string())?; }
        }
    }
    Ok(())
}

#[tauri::command]
pub fn begin_resize(app: AppHandle, state: State<'_, DesktopState>, x: f64, y: f64) -> Result<(), String> {
    let window = main_window(&app)?;
    let size = window.inner_size().map_err(|e| e.to_string())?;
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    *state.resize.lock().map_err(|e| e.to_string())? = Some(ResizeStart { x, y, width: size.width, height: size.height, scale });
    Ok(())
}

#[tauri::command]
pub fn resize_to(app: AppHandle, state: State<'_, DesktopState>, x: f64, y: f64) -> Result<(), String> {
    if !x.is_finite() || !y.is_finite() { return Err("Invalid resize coordinates".into()); }
    let guard = state.resize.lock().map_err(|e| e.to_string())?;
    if let Some(start) = guard.as_ref() {
        let width = (start.width as f64 + (x - start.x) * start.scale).max(180.0 * start.scale) as u32;
        let height = (start.height as f64 + (y - start.y) * start.scale).max(140.0 * start.scale) as u32;
        main_window(&app)?.set_size(PhysicalSize::new(width, height)).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn end_resize(state: State<'_, DesktopState>) -> Result<(), String> {
    *state.resize.lock().map_err(|e| e.to_string())? = None;
    Ok(())
}

#[tauri::command]
pub fn set_display_mode(app: AppHandle, state: State<'_, DesktopState>, mode: String) -> Result<(), String> {
    if mode != "drawer" && mode != "fixed" { return Err("Invalid display mode".into()); }
    let enabled = mode == "drawer";
    let main = main_window(&app)?;
    state.drawer.store(enabled, Ordering::SeqCst);
    *state.grace.lock().map_err(|e| e.to_string())? = Instant::now() + Duration::from_millis(350);
    if enabled {
        main.set_always_on_top(true).map_err(|e| e.to_string())?;
        if let (Ok(pos), Ok(Some(monitor))) = (main.outer_position(), main.current_monitor()) {
            main.set_position(PhysicalPosition::new(pos.x, monitor.work_area().position.y)).map_err(|e| e.to_string())?;
        }
    } else {
        if let Some(handle) = app.get_webview_window("drawer-handle") { let _ = handle.hide(); }
        let pinned = app.state::<Tasks>().0.lock().ok().and_then(|data| data.1.settings.get("alwaysOnTop").and_then(|v| v.as_bool())).unwrap_or(true);
        main.set_always_on_top(pinned).map_err(|e| e.to_string())?;
        main.show().map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn create_drawer(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let handle = WebviewWindowBuilder::new(app, "drawer-handle", WebviewUrl::App("handle.html".into()))
        .inner_size(88.0, 7.0).decorations(false).transparent(true).resizable(false)
        .skip_taskbar(true).always_on_top(true).focusable(false).focused(false).visible(false).build()?;
    handle.set_ignore_cursor_events(true)?;
    Ok(())
}

pub fn start_drawer(app: AppHandle) {
    std::thread::spawn(move || loop {
        let state = app.state::<DesktopState>();
        if !state.drawer.load(Ordering::SeqCst) { std::thread::sleep(Duration::from_millis(500)); continue; }
        std::thread::sleep(Duration::from_millis(75));
        let (Some(main), Some(handle)) = (app.get_webview_window("main"), app.get_webview_window("drawer-handle")) else { continue };
        let (Ok(pos), Ok(size), Ok(Some(monitor)), Ok(cursor), Ok(visible)) =
            (main.outer_position(), main.outer_size(), main.current_monitor(), app.cursor_position(), main.is_visible()) else { continue };
        let monitor_pos = monitor.position();
        let monitor_size = monitor.size();
        let scale = monitor.scale_factor();
        let handle_width = (88.0 * scale).round().min(size.width as f64).min(monitor_size.width as f64) as u32;
        let min_x = monitor_pos.x;
        let max_x = monitor_pos.x + monitor_size.width as i32 - handle_width as i32;
        let edge_x = (pos.x + (size.width as i32 - handle_width as i32) / 2).clamp(min_x, max_x);
        let edge_y = monitor_pos.y;
        let margin = 10.0 * scale;
        let at_edge = cursor.x >= edge_x as f64 - margin && cursor.x <= edge_x as f64 + handle_width as f64 + margin && cursor.y >= edge_y as f64 && cursor.y <= edge_y as f64 + 17.0 * scale;
        if visible {
            if handle.is_visible().unwrap_or(false) { let _ = handle.hide(); }
            let within = cursor.x >= pos.x as f64 - 2.0 && cursor.x <= (pos.x as i64 + size.width as i64) as f64 + 2.0 && cursor.y >= pos.y as f64 - 2.0 && cursor.y <= (pos.y as i64 + size.height as i64) as f64 + 2.0;
            let grace = state.grace.lock().map(|time| *time).unwrap_or_else(|_| Instant::now());
            if !within && !at_edge && Instant::now() > grace {
                let _ = app.emit_to("main", "drawer-motion", "close");
                std::thread::sleep(Duration::from_millis(100));
                let current = app.cursor_position();
                let still_outside = current.map(|point| point.x < pos.x as f64 - margin || point.x > (pos.x as i64 + size.width as i64) as f64 + margin || point.y < pos.y as f64 - margin || point.y > (pos.y as i64 + size.height as i64) as f64 + margin).unwrap_or(false);
                if state.drawer.load(Ordering::SeqCst) && still_outside { let _ = main.hide(); }
                else { let _ = app.emit_to("main", "drawer-motion", "open"); }
            }
        } else {
            let target_size = PhysicalSize::new(handle_width, (7.0 * scale).round() as u32);
            let target_position = PhysicalPosition::new(edge_x, edge_y);
            if handle.inner_size().ok() != Some(target_size) { let _ = handle.set_size(target_size); }
            if handle.outer_position().ok() != Some(target_position) { let _ = handle.set_position(target_position); }
            if !handle.is_visible().unwrap_or(false) { let _ = handle.show(); }
            if at_edge {
                let _ = handle.hide();
                let _ = main.set_position(PhysicalPosition::new(pos.x, monitor.work_area().position.y));
                let _ = main.show();
                let _ = app.emit_to("main", "drawer-motion", "open");
                if let Ok(mut grace) = state.grace.lock() { *grace = Instant::now() + Duration::from_millis(250); }
            }
        }
    });
}

pub fn mark_shown(app: &AppHandle) {
    let state = app.state::<DesktopState>();
    if let Ok(mut grace) = state.grace.lock() { *grace = Instant::now() + Duration::from_millis(500); };
}

pub fn restore(app: &AppHandle) -> Result<(), String> {
    let settings = app.state::<Tasks>().0.lock().map_err(|e| e.to_string())?.1.settings.clone();
    let main = main_window(app)?;
    let mode = settings.get("displayMode").and_then(|v| v.as_str()).unwrap_or("fixed");
    let bounds = settings.get(if mode == "drawer" { "drawerBounds" } else { "windowBounds" });
    if let Some(bounds) = bounds {
        let x = bounds.get("x").and_then(|v| v.as_i64());
        let y = bounds.get("y").and_then(|v| v.as_i64());
        let width = bounds.get("width").and_then(|v| v.as_u64());
        let height = bounds.get("height").and_then(|v| v.as_u64());
        if let (Some(x), Some(y), Some(width), Some(height)) = (x, y, width, height) {
            let monitors = main.available_monitors().map_err(|e| e.to_string())?;
            let visible = monitors.iter().any(|m| {
                let p = m.position(); let s = m.size();
                x + 40 >= p.x as i64 && y + 40 >= p.y as i64 && x < p.x as i64 + s.width as i64 && y < p.y as i64 + s.height as i64
            });
            if visible && (180..=8192).contains(&width) && (140..=8192).contains(&height) && i32::try_from(x).is_ok() && i32::try_from(y).is_ok() {
                main.set_size(PhysicalSize::new(width as u32, height as u32)).map_err(|e| e.to_string())?;
                main.set_position(PhysicalPosition::new(x as i32, y as i32)).map_err(|e| e.to_string())?;
            }
        }
    }
    main.set_always_on_top(settings.get("alwaysOnTop").and_then(|v| v.as_bool()).unwrap_or(true) || mode == "drawer").map_err(|e| e.to_string())?;
    if mode == "drawer" { set_display_mode(app.clone(), app.state::<DesktopState>(), "drawer".into())?; }
    Ok(())
}

pub fn mark_bounds_changed(app: &AppHandle) {
    app.state::<DesktopState>().bounds_revision.fetch_add(1, Ordering::Relaxed);
}

pub fn start_bounds_saver(app: AppHandle) {
    std::thread::spawn(move || {
        let mut seen = 0;
        loop {
            std::thread::sleep(Duration::from_millis(400));
            let state = app.state::<DesktopState>();
            let revision = state.bounds_revision.load(Ordering::Relaxed);
            if revision == seen { continue; }
            std::thread::sleep(Duration::from_millis(400));
            if revision != state.bounds_revision.load(Ordering::Relaxed) { continue; }
            let Some(window) = app.get_webview_window("main") else { continue };
            let (Ok(position), Ok(size)) = (window.outer_position(), window.inner_size()) else { continue };
            let tasks = app.state::<Tasks>();
            let Ok(mut state) = tasks.0.lock() else { continue };
            let mut data = state.1.clone();
            if !data.settings.is_object() { data.settings = serde_json::json!({}); }
            let field = if data.settings.get("displayMode").and_then(|x| x.as_str()) == Some("drawer") { "drawerBounds" } else { "windowBounds" };
            data.settings[field] = serde_json::json!({"x":position.x,"y":position.y,"width":size.width,"height":size.height});
            if let Err(error) = state.0.save(&data) { eprintln!("Could not save window bounds: {error}"); continue; }
            state.1 = data;
            seen = revision;
        }
    });
}
