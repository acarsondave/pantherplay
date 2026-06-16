use tauri::{State, ipc::Channel};
use std::sync::Mutex;
use crate::audio::{AudioEngine, AudioEvent, AudioDevice, list_input_devices};

pub struct AudioState(pub Mutex<AudioEngine>);

#[tauri::command]
pub fn start_listening(
    device_id: Option<String>,
    on_event: Channel<AudioEvent>,
    state: State<'_, AudioState>,
) -> Result<(), String> {
    let engine = state.0.lock().map_err(|_| "Mutex poisoned")?;
    engine.start(device_id, on_event)
}

#[tauri::command]
pub fn stop_listening(state: State<'_, AudioState>) -> Result<(), String> {
    let engine = state.0.lock().map_err(|_| "Mutex poisoned")?;
    engine.stop();
    Ok(())
}

#[tauri::command]
pub fn get_audio_devices() -> Vec<AudioDevice> {
    list_input_devices()
}
