use rustfft::{FftPlanner, num_complex::Complex};
use std::sync::Arc;
use std::collections::VecDeque;

pub struct OnsetDetector {
    fft: Arc<dyn rustfft::Fft<f32>>,
    prev_spectrum: Vec<f32>,
    window: Vec<f32>,
    complex_buffer: Vec<Complex<f32>>,

    // Adaptive thresholding
    flux_history: VecDeque<f32>,
    flux_history_size: usize,
    threshold_multiplier: f32,

    // Refractory period: minimum frames between detections
    frames_since_last_onset: usize,
    min_frames_between_onsets: usize,
}

impl OnsetDetector {
    pub fn new(frame_size: usize, sample_rate: usize) -> Self {
        let mut planner = FftPlanner::new();
        let fft = planner.plan_fft_forward(frame_size);

        // Hann window
        let window: Vec<f32> = (0..frame_size)
            .map(|i| {
                0.5 * (1.0 - (2.0 * std::f32::consts::PI * i as f32 / (frame_size as f32 - 1.0)).cos())
            })
            .collect();

        // At 44100 Hz with 4096 frame size, each frame is ~93ms.
        // 150ms refractory = ~2 frames.
        let ms_per_frame = (frame_size as f32 / sample_rate as f32) * 1000.0;
        let min_frames = (150.0 / ms_per_frame).ceil() as usize;

        Self {
            fft,
            prev_spectrum: vec![0.0; frame_size],
            window,
            complex_buffer: Vec::with_capacity(frame_size),
            flux_history: VecDeque::with_capacity(30),
            flux_history_size: 30,
            threshold_multiplier: 2.5,
            frames_since_last_onset: min_frames, // Allow detection on first frame
            min_frames_between_onsets: min_frames,
        }
    }

    /// Process a frame and return true if an onset (strum) was detected.
    /// Uses adaptive thresholding: onset fires when spectral flux exceeds
    /// median(recent_flux) * multiplier.
    pub fn detect(&mut self, frame: &[f32]) -> bool {
        if frame.len() != self.window.len() {
            return false;
        }

        self.frames_since_last_onset += 1;

        // Apply window and convert to complex
        self.complex_buffer.clear();
        self.complex_buffer.extend(
            frame.iter()
                .zip(self.window.iter())
                .map(|(&s, &w)| Complex { re: s * w, im: 0.0 })
        );

        // Perform FFT
        self.fft.process(&mut self.complex_buffer);

        // Compute half-wave rectified spectral flux
        let mut flux = 0.0;
        let half = self.complex_buffer.len() / 2;
        for i in 0..half {
            let mag = self.complex_buffer[i].norm();
            let diff = mag - self.prev_spectrum[i];
            if diff > 0.0 {
                flux += diff;
            }
            self.prev_spectrum[i] = mag;
        }

        // Push flux into history
        self.flux_history.push_back(flux);
        if self.flux_history.len() > self.flux_history_size {
            self.flux_history.pop_front();
        }

        // Need enough history for a meaningful median
        if self.flux_history.len() < 5 {
            return false;
        }

        // Compute median of flux history
        let median = {
            let mut sorted: Vec<f32> = self.flux_history.iter().copied().collect();
            sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
            sorted[sorted.len() / 2]
        };

        // Adaptive threshold
        let threshold = median * self.threshold_multiplier;

        // Check onset with refractory period
        if flux > threshold && self.frames_since_last_onset >= self.min_frames_between_onsets {
            self.frames_since_last_onset = 0;
            true
        } else {
            false
        }
    }
}
