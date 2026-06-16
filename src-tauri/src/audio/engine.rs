use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use ringbuf::{traits::*, HeapRb};
use serde::Serialize;
use std::sync::{Arc, atomic::{AtomicBool, Ordering}};
use tauri::ipc::Channel;

use pitch_detection::detector::mcleod::McLeodDetector;
use pitch_detection::detector::PitchDetector;

use super::chromagram::Chromagram;
use chord_detector::{ChordDetector, NoteName, ChordKind};
use super::onset::OnsetDetector;

#[derive(Clone, Serialize)]
#[serde(tag = "type")]
pub enum AudioEvent {
    ChordDetected { chord: String, confidence: f32, timestamp: u64 },
    OnsetDetected { timestamp: u64, energy: f32 },
    AudioLevel { rms: f32 },
    CalibrationComplete { frequency: f32 },
}

/// Minimum RMS level to consider a frame as containing audio.
const SILENCE_THRESHOLD: f32 = 0.008;

pub struct AudioEngine {
    is_running: Arc<AtomicBool>,
    calibration_trigger: Arc<AtomicBool>,
}

impl AudioEngine {
    pub fn new() -> Self {
        Self {
            is_running: Arc::new(AtomicBool::new(false)),
            calibration_trigger: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn trigger_calibration(&self) {
        self.calibration_trigger.store(true, Ordering::SeqCst);
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

        let ringbuf_capacity = sample_rate * 2; // 2 seconds
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
        let is_calibrating = self.calibration_trigger.clone();

        std::thread::spawn(move || {
            let _stream_keeper = stream;

            let frame_size = 1024; // smaller frame size for low latency
            
            // Build our dynamically tunable chromagram with downsample_factor = 1 for ~90ms latency
            let mut chromagram = Chromagram::builder()
                .frame_size(frame_size)
                .sampling_rate(sample_rate)
                .downsample_factor(1)
                .build()
                .unwrap();
                
            // Use the crate's battle-tested detector with overtone bleed suppression
            let mut chord_detector = ChordDetector::builder()
                .bleed(0.15)
                .build();
                
            let mut onset_detector = OnsetDetector::new(frame_size, sample_rate);

            let mut buffer = Vec::with_capacity(frame_size * 8);
            let mut calibration_buffer = Vec::new();

            // State: only emit chord changes after an onset
            let mut last_emitted_chord: Option<String> = None;
            let mut onset_armed = false;
            let mut silent_frame_count: usize = 0;

            while is_running_proc.load(Ordering::Relaxed) {
                let avail = cons.occupied_len();
                if avail > 0 {
                    buffer.extend(cons.pop_iter());
                }
                
                // Calibration Mode
                if is_calibrating.load(Ordering::SeqCst) {
                    if buffer.len() > 0 {
                        calibration_buffer.extend(buffer.drain(..));
                    }
                    
                    // Wait until we have about 0.5s of audio for a solid pitch reading
                    if calibration_buffer.len() >= sample_rate / 2 {
                        let mut mcleod = McLeodDetector::new(calibration_buffer.len(), calibration_buffer.len() / 2);
                        // Convert f32 to f64 for pitch-detection crate
                        let signal_f64: Vec<f64> = calibration_buffer.iter().map(|&x| x as f64).collect();
                        
                        if let Some(pitch) = mcleod.get_pitch(&signal_f64, sample_rate, 5.0, 0.7) {
                            let f = pitch.frequency;
                            
                            // 1. Find the closest standard MIDI note to the detected frequency
                            // MIDI note 69 is A4 (440Hz)
                            let midi_float = 12.0 * (f / 440.0).log2() + 69.0;
                            let midi_closest = midi_float.round();
                            
                            // 2. Calculate what the perfect frequency for that note SHOULD be
                            let f_standard = 440.0 * 2f64.powf((midi_closest - 69.0) / 12.0);
                            
                            // 3. Calculate the tuning ratio (e.g. 0.98 if they are slightly flat)
                            let ratio = f / f_standard;
                            
                            // 4. Calculate the new A4 reference by applying the ratio to 440Hz
                            let new_a4 = 440.0 * ratio;
                            
                            // 5. Chromagram expects the frequency of C3 as the reference.
                            // C3 is exactly 21 semitones below A4.
                            let c3 = (new_a4 * 2f64.powf(-21.0 / 12.0)) as f32;
                            chromagram.set_reference_frequency(c3);
                            
                            let _ = on_event.send(AudioEvent::CalibrationComplete { frequency: new_a4 as f32 });
                        } else {
                            // Failed to detect clear pitch, send 0 to indicate failure
                            let _ = on_event.send(AudioEvent::CalibrationComplete { frequency: 0.0 });
                        }
                        
                        calibration_buffer.clear();
                        is_calibrating.store(false, Ordering::SeqCst);
                    }
                    std::thread::sleep(std::time::Duration::from_millis(5));
                    continue;
                }

                // Normal Mode
                while buffer.len() >= frame_size {
                    let frame = &buffer[0..frame_size];

                    // === NOISE GATE ===
                    let rms = (frame.iter().map(|x| x * x).sum::<f32>() / frame_size as f32).sqrt();
                    let _ = on_event.send(AudioEvent::AudioLevel { rms });

                    if rms < SILENCE_THRESHOLD {
                        silent_frame_count += 1;
                        if silent_frame_count > 10 {
                            last_emitted_chord = None;
                            onset_armed = false;
                        }
                        // Still feed the frame into chromagram to keep its circular buffer valid, 
                        // but ignore the output.
                        let _ = chromagram.next(frame);
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
                    if let Ok(Some(chroma_bins)) = chromagram.next(frame) {
                        if let Ok(chord) = chord_detector.detect_chord(&chroma_bins) {
                            // Confidence score is a distance, so lower is better. 
                            // Let's invert it for our UI (0.0 to 1.0, higher is better).
                            // A perfect match is 0.0 distance. 
                            let inverted_confidence = (1.0 - chord.confidence).max(0.0);
                            
                            // Only accept somewhat confident readings
                            if inverted_confidence > 0.5 {
                                let chord_str = format!("{:?} {:?}", chord.root, chord.quality)
                                    .replace("Major", "")
                                    .replace("Minor", "m")
                                    .replace("PowerFifth", "5")
                                    .replace("DominantSeventh", "7")
                                    .replace("MajorSeventh", "maj7")
                                    .replace("MinorSeventh", "m7")
                                    .replace("SuspendedSecond", "sus2")
                                    .replace("SuspendedFourth", "sus4")
                                    .replace("Unknown", "")
                                    .trim()
                                    .to_string();

                                let is_new_chord = last_emitted_chord.as_ref() != Some(&chord_str);

                                if onset_armed || last_emitted_chord.is_none() {
                                    let _ = on_event.send(AudioEvent::ChordDetected {
                                        chord: chord_str.clone(),
                                        confidence: inverted_confidence,
                                        timestamp: 0,
                                    });
                                    last_emitted_chord = Some(chord_str);
                                    if is_new_chord {
                                        onset_armed = false;
                                    }
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
