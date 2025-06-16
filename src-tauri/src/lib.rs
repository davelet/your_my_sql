//! Main library for the You My SQL application

pub mod commands;
mod setup;

pub use commands::*;
pub use setup::setup_app;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .setup(setup_app)
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                // Get a handle to the connection manager and close all connections
                let mut manager = match you_my_sql_db::CONNECTION_MANAGER.lock() {
                    Ok(manager) => manager,
                    Err(e) => {
                        eprintln!("Failed to acquire lock on connection manager: {}", e);
                        return;
                    }
                };
                
                // Close all database connections
                if let Err(e) = manager.close_all_connections() {
                    eprintln!("Error closing database connections: {}", e);
                }
                
                // Save window state before closing
                if let Err(e) = save_window_state_local(window) {
                    eprintln!("Error saving window state: {}", e);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            connect_to_database,
            execute_query,
            list_databases,
            list_tables,
            get_table_data,
            close_connection,
            close_all_connections,
            get_app_config,
            save_app_config,
            save_window_state,
            get_window_state
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// Internal function to save window state
fn save_window_state_local(window: &tauri::Window) -> Result<(), String> {
    let position = window.outer_position().map_err(|e| e.to_string())?;
    let size = window.outer_size().map_err(|e| e.to_string())?;
    
    let params = crate::commands::WindowStateParams {
        x: position.x,
        y: position.y,
        width: size.width as f64,  // Convert u32 to f64
        height: size.height as f64, // Convert u32 to f64
    };
    
    save_window_state_internal(params)
}
