use super::templates::{get_templates, ChordTemplate};

pub struct ChordClassifier {
    templates: Vec<ChordTemplate>,
    // Temporal smoothing: require multiple frames to agree
    history: Vec<String>,
    history_size: usize,
}

impl ChordClassifier {
    pub fn new() -> Self {
        Self {
            templates: get_templates(),
            history: Vec::with_capacity(5),
            history_size: 5,
        }
    }

    /// Classify a normalized chroma vector.
    /// Returns (best_chord_name, confidence)
    pub fn classify(&mut self, chroma: &[f32; 12]) -> (String, f32) {
        let mut best_score = -1.0_f32;
        let mut best_chord = "Unknown";

        for template in &self.templates {
            let score = cosine_similarity(chroma, &template.profile);
            if score > best_score {
                best_score = score;
                best_chord = template.name;
            }
        }

        // Temporal smoothing
        self.history.push(best_chord.to_string());
        if self.history.len() > self.history_size {
            self.history.remove(0);
        }

        // Find most frequent chord in history
        let mut counts = std::collections::HashMap::new();
        for chord in &self.history {
            *counts.entry(chord.clone()).or_insert(0) += 1;
        }

        let mut smoothed_chord = best_chord.to_string();
        let mut max_count = 0;
        for (chord, count) in counts {
            if count > max_count {
                max_count = count;
                smoothed_chord = chord;
            }
        }

        (smoothed_chord, best_score)
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
