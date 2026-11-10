#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use tauri::Manager;

fn main() {
  tauri::Builder::default()
    .setup(|app| {
      // Restore only the library directory explicitly chosen by the user.
      if let Some(dir) = app.path_resolver().app_dir() {
        if let Ok(text) = std::fs::read_to_string(dir.join("settings.json")) {
          if let Ok(settings) = serde_json::from_str::<serde_json::Value>(&text) {
            if let Some(folder) = settings.get("folder").and_then(|value| value.as_str()) {
              if !folder.is_empty() {
                app.fs_scope().allow_directory(folder, true)?;
                app.asset_protocol_scope().allow_directory(folder, true)?;
              }
            }
          }
        }
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
