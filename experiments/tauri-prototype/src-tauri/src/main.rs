#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::{atomic::{AtomicBool, Ordering}, Arc};
use std::time::Duration;
use tauri::{menu::{Menu, MenuItem}, tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent}, Manager, State, WebviewUrl, WebviewWindowBuilder, WindowEvent};

struct AlarmState(Arc<AtomicBool>);

#[tauri::command]
fn schedule_test_reminder(app: tauri::AppHandle, state: State<'_, AlarmState>) -> Result<(), String> {
    if state.0.swap(true, Ordering::SeqCst) {
        return Err("A test reminder is already scheduled".into());
    }
    let active = state.0.clone();
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
fn dismiss_test_reminder(app: tauri::AppHandle, state: State<'_, AlarmState>) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("reminder") {
        window.destroy().map_err(|error| error.to_string())?;
    }
    state.0.store(false, Ordering::SeqCst);
    Ok(())
}

fn show_main(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn main() {
    tauri::Builder::default()
        .manage(AlarmState(Arc::new(AtomicBool::new(false))))
        .invoke_handler(tauri::generate_handler![schedule_test_reminder, dismiss_test_reminder])
        .setup(|app| {
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
              if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
              }
            } else if window.label() == "reminder" && matches!(event, WindowEvent::Destroyed) {
                window.state::<AlarmState>().0.store(false, Ordering::SeqCst);
            }
        })
        .run(tauri::generate_context!())
        .expect("failed to run Daymark prototype");
}
