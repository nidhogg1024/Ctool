#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

/// 切换开发者工具（v2 使用 WebviewWindow 类型）
#[tauri::command]
fn toggle_dev_tools(window: tauri::WebviewWindow) {
    if !window.is_devtools_open() {
        window.open_devtools();
    } else {
        window.close_devtools();
    }
}

fn main() {
    tauri::Builder::default()
        // 注册 shell 插件（用于打开外部链接）
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            toggle_dev_tools
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
