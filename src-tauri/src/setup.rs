//! Application setup module

use tauri::Manager;
use you_my_sql_config::{read_config};

/// Setup function for the application
pub fn setup_app(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let window = app.get_webview_window("main").expect("failed to get main window");
    
    // Load saved window state
    if let Ok(config) = read_config() {
        if let Some(state) = config.window_state {
            // Set window size and position
            if let (Some(x), Some(y)) = (state.x, state.y) {
                if x >= 0 && y >= 0 {
                    let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(x as i32, y as i32)));
                }
            }
            
            let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize::new(
                state.width as u32,
                state.height as u32,
            )));
        }
    }
    
    Ok(())
}