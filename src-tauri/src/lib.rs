pub mod audio;
pub mod commands;

use std::sync::Mutex;
use audio::AudioEngine;
use commands::audio::{start_listening, stop_listening, get_audio_devices, AudioState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AudioState(Mutex::new(AudioEngine::new())))
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            start_listening,
            stop_listening,
            get_audio_devices
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
