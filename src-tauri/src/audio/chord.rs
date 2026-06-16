use super::templates::get_templates;

pub struct ChordClassifier {
    templates: Vec<super::templates::ChordTemplate>,
    history: Vec<Option<String>>,
    history_size: usize,
    last_stable: Option<String>,
    stable_count: usize,
    min_stable_frames: usize,
    min_confidence: f32,
}

impl ChordClassifier {
    pub fn new() -> Self {
        Self {
            templates: get_templates(),
            history: Vec::with_capacity(8),
            history_size: 8,
            last_stable: None,
            stable_count: 0,
            min_stable_frames: 3,
            min_confidence: 0.80,
        }
    }

    /// Classify a normalized chroma vector.
    /// Returns Some((chord, confidence)) only when detection is stable and confident.
    /// Returns None on silence, noise, or unstable detection.
    pub fn classify(&mut self, chroma: &[f32; 12]) -> Option<(String, f32)> {
        let mut best_score = -1.0_f32;
        let mut best_chord: Option<&str> = None;

        for template in &self.templates {
            let score = cosine_similarity(chroma, &template.profile);
            if score > best_score {
                best_score = score;
                best_chord = Some(template.name);
            }
        }

        // Hard confidence floor: reject low-confidence matches entirely
        if best_score < self.min_confidence {
            self.history.push(None);
            if self.history.len() > self.history_size {
                self.history.remove(0);
            }
            return None;
        }

        let chord_name = best_chord.unwrap().to_string();

        // Push into history
        self.history.push(Some(chord_name.clone()));
        if self.history.len() > self.history_size {
            self.history.remove(0);
        }

        // Find the most frequent non-None chord in history
        let smoothed = self.most_frequent_chord();

        match smoothed {
            Some(ref chord) => {
                // Track stability: how many consecutive frames agree
                if self.last_stable.as_ref() == Some(chord) {
                    self.stable_count += 1;
                } else {
                    self.last_stable = Some(chord.clone());
                    self.stable_count = 1;
                }

                // Only emit after min_stable_frames of agreement
                if self.stable_count >= self.min_stable_frames {
                    Some((chord.clone(), best_score))
                } else {
                    None
                }
            }
            None => {
                self.stable_count = 0;
                None
            }
        }
    }

    fn most_frequent_chord(&self) -> Option<String> {
        let mut best: Option<String> = None;
        let mut max_count = 0;

        for entry in &self.history {
            if let Some(chord) = entry {
                let count = self.history.iter()
                    .filter(|c| c.as_ref() == Some(chord))
                    .count();
                if count > max_count {
                    max_count = count;
                    best = Some(chord.clone());
                }
            }
        }

        // Require majority: at least half the history window must agree
        if max_count >= self.history_size / 2 {
            best
        } else {
            None
        }
    }

    /// Reset the classifier state (call when stopping/starting a session)
    pub fn reset(&mut self) {
        self.history.clear();
        self.last_stable = None;
        self.stable_count = 0;
    }
}

fn cosine_similarity(a: &[f32; 12], b: &[f32; 12]) -> f32 {
    let mut dot_product = 0.0;
    let mut norm_a = 0.0;
    let mut norm_b = 0.0;

    for i in 0..12 {
        dot_product += a[i] * b[i];
        norm_a += a[i] * a[i];
        norm_b += b[i] * b[i];
    }

    if norm_a == 0.0 || norm_b == 0.0 {
        return 0.0;
    }

    dot_product / (norm_a.sqrt() * norm_b.sqrt())
}
