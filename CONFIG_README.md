# Configuration System for You My SQL

## Overview

This document explains how the configuration system works in the You My SQL application. The application uses a TOML configuration file stored in the user's home directory to persist user settings.

## Configuration File Location

The configuration file is stored in the `~/.config/you-my-sql/` directory:

- **macOS**: `~/.config/you-my-sql/config.toml`
- **Windows**: `C:\Users\<username>\.config\you-my-sql\config.toml`
- **Linux**: `~/.config/you-my-sql/config.toml`

## Configuration Options

The configuration file contains the following settings:

```toml
# Example config.toml
theme = "light"          # Options: "light", "dark", "system"
font_size = 14           # Font size in pixels
show_line_numbers = true # Whether to show line numbers in SQL editor
max_rows_display = 100   # Maximum number of rows to display in query results
recent_connections = []  # List of recently used connection IDs
```

## How It Works

### Backend (Rust)

The configuration system is implemented in the `config.rs` module, which provides:

1. `AppConfig` struct - Defines the structure of the configuration
2. `read_config()` - Reads the configuration from disk, creating a default one if it doesn't exist
3. `write_config()` - Writes the configuration to disk
4. `get_config_file_path()` - Helper function to get the path to the configuration file

These functions are exposed to the frontend via Tauri commands:

- `get_app_config` - Retrieves the current configuration
- `save_app_config` - Saves changes to the configuration

### Frontend (Vue)

The `ConfigSettings.vue` component provides a user interface for viewing and modifying the configuration. It:

1. Loads the configuration when the component is mounted
2. Provides form controls for modifying settings
3. Saves changes back to the configuration file

## Adding New Configuration Options

To add a new configuration option:

1. Update the `AppConfig` struct in `config.rs`
2. Update the `Default` implementation for `AppConfig`
3. Update the `ConfigSettings.vue` component to include UI controls for the new option

## Accessing Configuration in Other Components

You can access the configuration in other components by invoking the `get_app_config` Tauri command:

```javascript
import { invoke } from '@tauri-apps/api/tauri';

// Get the configuration
async function getConfig() {
  try {
    const response = await invoke('get_app_config');
    if (response.success && response.data) {
      return response.data;
    }
    return null;
  } catch (error) {
    console.error('Failed to load config:', error);
    return null;
  }
}
```

## Security Considerations

The configuration file is stored in the user's configuration directory, which is a secure location that only the user has access to. The file does not store sensitive information like database passwords.

## Troubleshooting

If the application is unable to read or write the configuration file, it will display an error message. Common issues include:

- Permissions issues with the configuration directory
- Corrupted configuration file

To resolve these issues, you can try:

1. Checking the permissions of the configuration directory (~/.config/you-my-sql/)
2. Deleting the configuration file (a new default one will be created)