use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use ringbuf::{traits::*, HeapRb};
use serde::Serialize;
use std::sync::{Arc, atomic::{AtomicBool, Ordering}};
use tauri::ipc::Channel;

use super::chromagram::Chromagram;
use super::chord::ChordClassifier;
use super::onset::OnsetDetector;

#[derive(Clone, Serialize)]
#[serde(tag = "type")]
pub enum AudioEvent {
    ChordDetected { chord: String, confidence: f32, timestamp: u64 },
    OnsetDetected { timestamp: u64, energy: f32 },
    AudioLevel { rms: f32 },
}

pub struct AudioEngine {
    is_running: Arc<AtomicBool>,
}

impl AudioEngine {
    pub fn new() -> Self {
        Self {
            is_running: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn start(&self, device_name: Option<String>, on_event: Channel<AudioEvent>) -> Result<(), String> {
        if self.is_running.load(Ordering::SeqCst) {
            return Err("Engine already running".to_string());
        }

        let host = cpal::default_host();
        
        let device = if let Some(name) = device_name {
            #[allow(deprecated)]
            let dev = host.input_devices()
                .map_err(|e| e.to_string())?
                .find(|d| d.name().unwrap_or_default() == name)
                .ok_or_else(|| "Device not found".to_string())?;
            dev
        } else {
            host.default_input_device()
                .ok_or_else(|| "No default input device".to_string())?
        };

        let config = device.default_input_config().map_err(|e| e.to_string())?;
        
        let sample_rate: u32 = config.sample_rate().into();
        let sample_rate = sample_rate as usize;
        
        let ringbuf_capacity = sample_rate; 
        let rb = HeapRb::<f32>::new(ringbuf_capacity);
        let (mut prod, mut cons) = rb.split();

        self.is_running.store(true, Ordering::SeqCst);
        let is_running_capture = self.is_running.clone();

        // 1. Start the cpal capture thread
        let stream = device.build_input_stream(
            &config.into(),
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                if !is_running_capture.load(Ordering::Relaxed) {
                    return;
                }
                prod.push_slice(data); // Lock-free push
            },
            move |err| {
                eprintln!("Audio input error: {}", err);
            },
            None,
        ).map_err(|e| e.to_string())?;

        stream.play().map_err(|e| e.to_string())?;

        // 2. Start the processing thread
        let is_running_proc = self.is_running.clone();
        
        std::thread::spawn(move || {
            // Keep stream alive in this thread's scope
            let _stream_keeper = stream;
            
            let frame_size = 4096; // ~93ms at 44.1kHz
            let mut chromagram = Chromagram::new(frame_size, sample_rate).unwrap();
            let mut classifier = ChordClassifier::new();
            let mut onset_detector = OnsetDetector::new(frame_size, 1000.0); // Tweak threshold
            
            let mut buffer = Vec::with_capacity(frame_size);
            
            // Loop until told to stop
            while is_running_proc.load(Ordering::Relaxed) {
                // Read from ring buffer into our local frame buffer
                let avail = cons.occupied_len();
                if avail > 0 {
                    buffer.extend(cons.pop_iter());
                }
                
                // Process full frames
                while buffer.len() >= frame_size {
                    let frame = &buffer[0..frame_size];
                    
                    // RMS for audio level
                    let rms = (frame.iter().map(|x| x * x).sum::<f32>() / frame_size as f32).sqrt();
                    let _ = on_event.send(AudioEvent::AudioLevel { rms });
                    
                    // Onset detection
                    if onset_detector.detect(frame) {
                        let _ = on_event.send(AudioEvent::OnsetDetected { 
                            timestamp: 0, // TODO: actual timestamp
                            energy: rms 
                        });
                    }
                    
                    // Chromagram & Chord Classification
                    if let Some(chroma) = chromagram.process_frame(frame) {
                        let (chord, confidence) = classifier.classify(&chroma);
                        let _ = on_event.send(AudioEvent::ChordDetected {
                            chord,
                            confidence,
                            timestamp: 0, // TODO: actual timestamp
                        });
                    }
                    
                    // Remove processed frame from buffer
                    buffer.drain(0..frame_size);
                }
                
                // Yield to avoid pegging CPU if ringbuf is empty
                std::thread::sleep(std::time::Duration::from_millis(5));
            }
        });

        Ok(())
    }

    pub fn stop(&self) {
        self.is_running.store(false, Ordering::SeqCst);
    }
}
