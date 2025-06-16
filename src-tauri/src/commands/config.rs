//! Configuration-related commands

use you_my_sql_config::{AppConfig, read_config, write_config};
use super::CommandResponse;

#[tauri::command]
pub async fn get_app_config() -> CommandResponse<AppConfig> {
    match read_config() {
        Ok(config) => CommandResponse::success(config),
        Err(e) => CommandResponse::error(e),
    }
}

#[tauri::command]
pub async fn save_app_config(config: AppConfig) -> CommandResponse<()> {
    match write_config(&config) {
        Ok(_) => CommandResponse::success(()),
        Err(e) => CommandResponse::error(e),
    }
}