use tauri_plugin_shell::ShellExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Start the pglens server sidecar
            let sidecar = app
                .shell()
                .sidecar("pglens-server")
                .expect("failed to create sidecar command")
                .args(["--no-open"]);

            let (mut _rx, _child) = sidecar.spawn().expect("failed to spawn sidecar");

            log::info!("pglens server sidecar started");

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
