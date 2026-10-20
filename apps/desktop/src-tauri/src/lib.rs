use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

#[derive(Serialize)]
struct StoredFile {
    path: String,
    content: String,
}

#[derive(Serialize)]
struct CustomContent {
    folder: String,
    files: Vec<StoredFile>,
}

/// Portable mode keeps everything in a `dndbuilder-data` folder next to the executable, so
/// the app can run from a USB stick without touching the user profile. It is on when the
/// executable's name contains "portable" (the released `..._portable.exe`) or a file named
/// `portable` / `portable.txt` sits next to it. Returns `None` when portable mode is off or
/// the folder cannot be created (e.g. a read-only location), so the app falls back to the
/// usual per-user folders.
fn portable_data_dir() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let dir = exe.parent()?;
    let named_portable = exe
        .file_stem()
        .map(|s| s.to_string_lossy().to_lowercase().contains("portable"))
        .unwrap_or(false);
    let marker = dir.join("portable").is_file() || dir.join("portable.txt").is_file();
    if !named_portable && !marker {
        return None;
    }
    let data = dir.join("dndbuilder-data");
    fs::create_dir_all(&data).ok()?;
    Some(data)
}

/// Folder where users can drop their own XML content (like Aurora's "custom" folder).
fn custom_content_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    if let Some(data) = portable_data_dir() {
        return Ok(data.join("custom"));
    }
    let base = app
        .path()
        .document_dir()
        .or_else(|_| app.path().app_data_dir())
        .map_err(|e| e.to_string())?;
    Ok(base.join("dndbuilder").join("custom"))
}

fn collect_xml(root: &Path, dir: &Path, out: &mut Vec<StoredFile>) -> std::io::Result<()> {
    let mut entries: Vec<_> = fs::read_dir(dir)?.filter_map(Result::ok).collect();
    entries.sort_by_key(|e| e.path());
    for entry in entries {
        let path = entry.path();
        if path.is_dir() {
            collect_xml(root, &path, out)?;
        } else if path
            .extension()
            .map(|e| e.eq_ignore_ascii_case("xml"))
            .unwrap_or(false)
        {
            // Skip unreadable/non-UTF-8 files instead of failing the whole scan.
            if let Ok(content) = fs::read_to_string(&path) {
                let rel = path.strip_prefix(root).unwrap_or(&path);
                out.push(StoredFile {
                    path: rel.to_string_lossy().replace('\\', "/"),
                    content,
                });
            }
        }
    }
    Ok(())
}

#[tauri::command]
fn read_custom_content(app: tauri::AppHandle) -> Result<CustomContent, String> {
    let dir = custom_content_dir(&app)?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let mut files = Vec::new();
    collect_xml(&dir, &dir, &mut files).map_err(|e| e.to_string())?;
    Ok(CustomContent {
        folder: dir.to_string_lossy().into_owned(),
        files,
    })
}

#[tauri::command]
fn open_custom_content_folder(app: tauri::AppHandle) -> Result<(), String> {
    let dir = custom_content_dir(&app)?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    #[cfg(target_os = "windows")]
    let program = "explorer";
    #[cfg(target_os = "macos")]
    let program = "open";
    #[cfg(all(unix, not(target_os = "macos")))]
    let program = "xdg-open";
    std::process::Command::new(program)
        .arg(&dir)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

/// Read a file the user picked in an open dialog.
#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("{}: {}", path, e))
}

/// Write a file the user picked in a save dialog.
#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| format!("{}: {}", path, e))
}

/// Write binary data (e.g. an exported PDF) to a file the user picked.
#[tauri::command]
fn write_binary_file(path: String, data: Vec<u8>) -> Result<(), String> {
    fs::write(&path, data).map_err(|e| format!("{}: {}", path, e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            read_custom_content,
            open_custom_content_folder,
            read_text_file,
            write_text_file,
            write_binary_file
        ])
        // The main window is created here (`"create": false` in tauri.conf.json) so that in
        // portable mode the webview profile, which holds the saved characters and settings,
        // lives next to the executable instead of in the user's AppData.
        .setup(|app| {
            let portable = portable_data_dir();
            for config in app.config().app.windows.clone() {
                let mut builder = tauri::WebviewWindowBuilder::from_config(app.handle(), &config)?;
                if let Some(data) = &portable {
                    builder = builder.data_directory(data.join("webview"));
                }
                builder.build()?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running dndbuilder");
}
