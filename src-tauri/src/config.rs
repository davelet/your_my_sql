use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::io::ErrorKind;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppConfig {
    pub theme: String,
    pub font_size: u8,
    pub show_line_numbers: bool,
    pub max_rows_display: usize,
    pub recent_connections: Vec<String>,
    // Add more configuration options as needed
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            theme: "light".to_string(),
            font_size: 14,
            show_line_numbers: true,
            max_rows_display: 100,
            recent_connections: Vec::new(),
        }
    }
}

pub fn get_config_file_path() -> Result<PathBuf, String> {
    // Get the app data directory using standard Rust APIs
    let app_data_dir = dirs::data_dir()
        .ok_or_else(|| "Could not find app data directory".to_string())?;
    
    // Create a directory for our app
    let app_dir = app_data_dir.join("com.davelet.you-my-sql.app");
    
    // Create the directory if it doesn't exist
    if !app_dir.exists() {
        fs::create_dir_all(&app_dir)
            .map_err(|e| format!("Failed to create app data directory: {}", e))?;
    }
    
    Ok(app_dir.join("config.toml"))
}

pub fn read_config() -> Result<AppConfig, String> {
    let config_path = get_config_file_path()?;
    
    // If the config file doesn't exist, return the default config
    match fs::read_to_string(&config_path) {
        Ok(content) => {
            toml::from_str(&content)
                .map_err(|e| format!("Failed to parse config file: {}", e))
        },
        Err(e) if e.kind() == ErrorKind::NotFound => {
            // Create default config file if it doesn't exist
            let default_config = AppConfig::default();
            write_config(&default_config)?;
            Ok(default_config)
        },
        Err(e) => Err(format!("Failed to read config file: {}", e)),
    }
}

pub fn write_config(config: &AppConfig) -> Result<(), String> {
    let config_path = get_config_file_path()?;
    
    let toml_string = toml::to_string(config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    
    fs::write(&config_path, toml_string)
        .map_err(|e| format!("Failed to write config file: {}", e))?;
    
    Ok(())
}