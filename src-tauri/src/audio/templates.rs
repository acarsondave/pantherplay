pub struct ChordTemplate {
    pub name: &'static str,
    pub profile: [f32; 12],
}

impl ChordTemplate {
    pub fn new(name: &'static str, notes: &[usize]) -> Self {
        let mut profile = [0.0; 12];
        for &note in notes {
            profile[note] = 1.0;
        }
        
        // Normalize the vector
        let magnitude: f32 = profile.iter().map(|x| x * x).sum::<f32>().sqrt();
        if magnitude > 0.0 {
            for v in profile.iter_mut() {
                *v /= magnitude;
            }
        }
        
        Self { name, profile }
    }
}

pub fn get_templates() -> Vec<ChordTemplate> {
    // Pitch class indices:
    // C=0, C#=1, D=2, D#=3, E=4, F=5, F#=6, G=7, G#=8, A=9, A#=10, B=11
    
    vec![
        // Major chords
        ChordTemplate::new("A", &[9, 1, 4]),   // A, C#, E
        ChordTemplate::new("C", &[0, 4, 7]),   // C, E, G
        ChordTemplate::new("D", &[2, 6, 9]),   // D, F#, A
        ChordTemplate::new("E", &[4, 8, 11]),  // E, G#, B
        ChordTemplate::new("G", &[7, 11, 2]),  // G, B, D
        
        // Minor chords
        ChordTemplate::new("Am", &[9, 0, 4]),  // A, C, E
        ChordTemplate::new("Dm", &[2, 5, 9]),  // D, F, A
        ChordTemplate::new("Em", &[4, 7, 11]), // E, G, B
    ]
}
