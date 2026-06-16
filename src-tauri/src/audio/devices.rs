use cpal::traits::{DeviceTrait, HostTrait};
use serde::Serialize;

#[derive(Serialize)]
pub struct AudioDevice {
    pub id: String,
    pub name: String,
}

pub fn list_input_devices() -> Vec<AudioDevice> {
    let mut devices = Vec::new();
    
    let host = cpal::default_host();
    if let Ok(input_devices) = host.input_devices() {
        for device in input_devices {
            #[allow(deprecated)]
            if let Ok(name) = device.name() {
                devices.push(AudioDevice {
                    id: name.clone(), // Using name as ID for simplicity
                    name,
                });
            }
        }
    }
    
    devices
}

pub fn get_default_device() -> Option<String> {
    let host = cpal::default_host();
    #[allow(deprecated)]
    host.default_input_device().and_then(|d| d.name().ok())
}
