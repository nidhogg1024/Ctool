#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::path::PathBuf;
use reqwest::blocking::Client;
use std::time::Duration;
use dirs;

/// 检查用户主目录下是否存在指定文件
fn check_file_exists_in_home_dir(file_path: &str) -> bool {
    let home_dir = match dirs::home_dir() {
        Some(path) => path,
        None => return false,
    };

    let file_path = PathBuf::from(&home_dir).join(file_path);
    file_path.exists()
}

/// 检查指定 URL 是否可访问（HEAD 请求，3秒超时）
fn is_url_accessible(url: &str) -> bool {
    let client = match Client::builder().timeout(Duration::from_secs(3)).build() {
        Ok(c) => c,
        Err(_) => return false,
    };
    match client.head(url).send() {
        Ok(resp) => resp.status().is_success(),
        Err(_) => false,
    }
}

/// 切换开发者工具（v2 使用 WebviewWindow 类型）
#[tauri::command]
fn toggle_dev_tools(window: tauri::WebviewWindow) {
    if !window.is_devtools_open() {
        window.open_devtools();
    } else {
        window.close_devtools();
    }
}

/// 判断是否使用离线模式
#[tauri::command]
fn ctool_is_use_offline() -> bool {
    // 强制使用本地离线版本 标示文件 ~/.ctool.tauri_use_local_file.lock
    if check_file_exists_in_home_dir(".ctool.tauri_use_local_file.lock") {
        return true;
    }
    // 验证 ctool.dev 是否可以访问
    !is_url_accessible("https://ctool.dev/_status.html")
}

fn main() {
    tauri::Builder::default()
        // 注册 shell 插件（用于打开外部链接）
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            toggle_dev_tools,
            ctool_is_use_offline
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
