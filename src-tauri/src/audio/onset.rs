use rustfft::{FftPlanner, num_complex::Complex};
use std::sync::Arc;

pub struct OnsetDetector {
    fft: Arc<dyn rustfft::Fft<f32>>,
    prev_spectrum: Vec<f32>,
    threshold: f32,
    window: Vec<f32>,
    complex_buffer: Vec<Complex<f32>>,
}

impl OnsetDetector {
    pub fn new(frame_size: usize, threshold: f32) -> Self {
        let mut planner = FftPlanner::new();
        let fft = planner.plan_fft_forward(frame_size);
        
        // Hann window
        let mut window = Vec::with_capacity(frame_size);
        for i in 0..frame_size {
            let multiplier = 0.5 * (1.0 - (2.0 * std::f32::consts::PI * i as f32 / (frame_size as f32 - 1.0)).cos());
            window.push(multiplier);
        }

        Self {
            fft,
            prev_spectrum: vec![0.0; frame_size],
            threshold,
            window,
            complex_buffer: Vec::with_capacity(frame_size),
        }
    }

    /// Process a frame and return true if an onset (strum) was detected
    pub fn detect(&mut self, frame: &[f32]) -> bool {
        if frame.len() != self.window.len() {
            return false;
        }

        // Apply window and convert to complex
        self.complex_buffer.clear();
        self.complex_buffer.extend(
            frame.iter()
                .zip(self.window.iter())
                .map(|(&s, &w)| Complex { re: s * w, im: 0.0 })
        );

        // Perform FFT
        self.fft.process(&mut self.complex_buffer);

        // Compute magnitude spectrum and spectral flux
        let mut flux = 0.0;
        for i in 0..self.complex_buffer.len() / 2 { // Only need first half (real signal)
            let mag = self.complex_buffer[i].norm();
            let diff = mag - self.prev_spectrum[i];
            if diff > 0.0 {
                flux += diff;
            }
            self.prev_spectrum[i] = mag;
        }

        // Simple thresholding for now. 
        // In reality, this needs adaptive thresholding (median of history).
        flux > self.threshold
    }
}
