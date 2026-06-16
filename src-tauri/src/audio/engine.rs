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

/// Minimum RMS level to consider a frame as containing audio.
/// Below this, the frame is treated as silence and no processing occurs.
/// Typical ambient laptop mic noise is ~0.002-0.005 RMS.
const SILENCE_THRESHOLD: f32 = 0.008;

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

        // Build input stream
        let stream = device.build_input_stream(
            &config.into(),
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                if !is_running_capture.load(Ordering::Relaxed) {
                    return;
                }
                prod.push_slice(data);
            },
            move |err| {
                eprintln!("Audio input error: {}", err);
            },
            None,
        ).map_err(|e| e.to_string())?;

        stream.play().map_err(|e| e.to_string())?;

        // Processing thread
        let is_running_proc = self.is_running.clone();

        std::thread::spawn(move || {
            let _stream_keeper = stream;

            let frame_size = 4096; // ~93ms at 44.1kHz
            let mut chromagram = Chromagram::new(frame_size, sample_rate).unwrap();
            let mut classifier = ChordClassifier::new();
            let mut onset_detector = OnsetDetector::new(frame_size, sample_rate);

            let mut buffer = Vec::with_capacity(frame_size);

            // State: only emit chord changes after an onset
            let mut last_emitted_chord: Option<String> = None;
            let mut onset_armed = false;
            let mut silent_frame_count: usize = 0;

            while is_running_proc.load(Ordering::Relaxed) {
                let avail = cons.occupied_len();
                if avail > 0 {
                    buffer.extend(cons.pop_iter());
                }

                while buffer.len() >= frame_size {
                    let frame = &buffer[0..frame_size];

                    // === NOISE GATE ===
                    let rms = (frame.iter().map(|x| x * x).sum::<f32>() / frame_size as f32).sqrt();
                    let _ = on_event.send(AudioEvent::AudioLevel { rms });

                    if rms < SILENCE_THRESHOLD {
                        // Silence: skip all processing
                        silent_frame_count += 1;

                        // After sustained silence (~1s), reset the classifier
                        // so stale history doesn't affect the next strum
                        if silent_frame_count > 10 {
                            classifier.reset();
                            last_emitted_chord = None;
                            onset_armed = false;
                        }

                        buffer.drain(0..frame_size);
                        continue;
                    }

                    silent_frame_count = 0;

                    // === ONSET DETECTION ===
                    if onset_detector.detect(frame) {
                        onset_armed = true;
                        let _ = on_event.send(AudioEvent::OnsetDetected {
                            timestamp: 0,
                            energy: rms,
                        });
                    }

                    // === CHROMAGRAM & CHORD CLASSIFICATION ===
                    if let Some(chroma) = chromagram.process_frame(frame) {
                        if let Some((chord, confidence)) = classifier.classify(&chroma) {
                            // Only emit a chord event when:
                            // 1. An onset has been detected (a strum happened), OR
                            // 2. This is the very first chord detected (initial strum)
                            let is_new_chord = last_emitted_chord.as_ref() != Some(&chord);

                            if onset_armed || last_emitted_chord.is_none() {
                                let _ = on_event.send(AudioEvent::ChordDetected {
                                    chord: chord.clone(),
                                    confidence,
                                    timestamp: 0,
                                });
                                last_emitted_chord = Some(chord);
                                if is_new_chord {
                                    onset_armed = false;
                                }
                            }
                        }
                    }

                    buffer.drain(0..frame_size);
                }

                std::thread::sleep(std::time::Duration::from_millis(5));
            }
        });

        Ok(())
    }

    pub fn stop(&self) {
        self.is_running.store(false, Ordering::SeqCst);
    }
}
