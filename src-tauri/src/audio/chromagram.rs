use chord_detector::Chromagram as NativeChromagram;

pub struct Chromagram {
    inner: NativeChromagram,
}

impl Chromagram {
    pub fn new(frame_size: usize, sample_rate: usize) -> Result<Self, String> {
        let inner = NativeChromagram::builder()
            .frame_size(frame_size)
            .sampling_rate(sample_rate)
            .build()
            .map_err(|e| format!("Failed to build chromagram: {:?}", e))?;
            
        Ok(Self { inner })
    }

    /// Process a frame of audio and return the 12-bin chromagram if ready
    pub fn process_frame(&mut self, frame: &[f32]) -> Option<[f32; 12]> {
        self.inner.next(frame).ok().flatten()
    }
}
