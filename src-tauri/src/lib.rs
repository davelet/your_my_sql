// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri::{Manager, WebviewWindowBuilder, WebviewUrl};
use image::io::Reader as ImageReader;
use std::io::Cursor;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn close_splashscreen(window: tauri::Window) {
    // Close the splashscreen
    if let Some(splashscreen) = window.get_webview_window("splashscreen") {
        splashscreen.close().unwrap();
    }
    // Show the main window
    if let Some(main_window) = window.get_webview_window("main") {
        main_window.show().unwrap();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, close_splashscreen])
        .setup(|app| {
            // 读取图片并转为字节（需提前将图片放在项目根目录）
            let img_bytes = include_bytes!("../../splash.jpg");
            let img = ImageReader::new(Cursor::new(img_bytes))
                .with_guessed_format()
                .map_err(|e| format!("Failed to read image format: {}", e))?
                .decode()
                .map_err(|e| format!("Failed to decode image: {}", e))?;

            // 创建启动窗口（无边框，尺寸匹配图片）
            let _splash = WebviewWindowBuilder::new(
                app,
                "splashscreen",
                WebviewUrl::App("about:blank".into()) // 空白页
            )
            .title("")
            .decorations(false)
            .inner_size(img.width() as f64, img.height() as f64)
            .center()
            .build()
            .map_err(|e| format!("Failed to build splash window: {}", e))?;

            // 延迟关闭启动屏幕并显示主窗口
            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(500));
                if let Some(splash) = app_handle.get_webview_window("splashscreen") {
                    let _ = splash.close();
                }
                if let Some(main_window) = app_handle.get_webview_window("main") {
                    let _ = main_window.show();
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
