mod db;

use db::{CONNECTION_MANAGER, ConnectionConfig, DbError, QueryResult};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize)]
struct CommandResponse<T> {
    success: bool,
    data: Option<T>,
    error: Option<String>,
}

impl<T> CommandResponse<T> {
    fn success(data: T) -> Self {
        CommandResponse {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    fn error(err: impl ToString) -> Self {
        CommandResponse {
            success: false,
            data: None,
            error: Some(err.to_string()),
        }
    }
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn connect_to_database(config: ConnectionConfig) -> CommandResponse<String> {
    let mut manager = match CONNECTION_MANAGER.lock() {
        Ok(manager) => manager,
        Err(e) => return CommandResponse::error(format!("Failed to acquire lock: {}", e)),
    };

    match manager.create_connection(config.clone()) {
        Ok(_) => CommandResponse::success(config.id),
        Err(e) => CommandResponse::error(e),
    }
}

#[tauri::command]
async fn execute_query(conn_id: String, query: String) -> CommandResponse<QueryResult> {
    let manager = match CONNECTION_MANAGER.lock() {
        Ok(manager) => manager,
        Err(e) => return CommandResponse::error(format!("Failed to acquire lock: {}", e)),
    };

    match manager.execute_query(&conn_id, &query) {
        Ok(result) => CommandResponse::success(result),
        Err(e) => CommandResponse::error(e),
    }
}

#[tauri::command]
async fn list_databases(conn_id: String) -> CommandResponse<Vec<String>> {
    let manager = match CONNECTION_MANAGER.lock() {
        Ok(manager) => manager,
        Err(e) => return CommandResponse::error(format!("Failed to acquire lock: {}", e)),
    };

    match manager.list_databases(&conn_id) {
        Ok(databases) => CommandResponse::success(databases),
        Err(e) => CommandResponse::error(e),
    }
}

#[tauri::command]
async fn list_tables(conn_id: String, database: String) -> CommandResponse<Vec<String>> {
    let manager = match CONNECTION_MANAGER.lock() {
        Ok(manager) => manager,
        Err(e) => return CommandResponse::error(format!("Failed to acquire lock: {}", e)),
    };

    match manager.list_tables(&conn_id, &database) {
        Ok(tables) => CommandResponse::success(tables),
        Err(e) => CommandResponse::error(e),
    }
}

#[tauri::command]
async fn get_table_data(conn_id: String, database: String, table: String, limit: usize) -> CommandResponse<QueryResult> {
    let manager = match CONNECTION_MANAGER.lock() {
        Ok(manager) => manager,
        Err(e) => return CommandResponse::error(format!("Failed to acquire lock: {}", e)),
    };

    match manager.get_table_data(&conn_id, &database, &table, limit) {
        Ok(result) => CommandResponse::success(result),
        Err(e) => CommandResponse::error(e),
    }
}

#[tauri::command]
async fn close_connection(conn_id: String) -> CommandResponse<()> {
    let mut manager = match CONNECTION_MANAGER.lock() {
        Ok(manager) => manager,
        Err(e) => return CommandResponse::error(format!("Failed to acquire lock: {}", e)),
    };

    match manager.close_connection(&conn_id) {
        Ok(_) => CommandResponse::success(()),
        Err(e) => CommandResponse::error(e),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            connect_to_database,
            execute_query,
            list_databases,
            list_tables,
            get_table_data,
            close_connection
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
