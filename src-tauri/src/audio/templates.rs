pub struct ChordTemplate {
    pub name: &'static str,
    pub profile: [f32; 12],
}

impl ChordTemplate {
    /// Create a chord template with harmonic weighting.
    /// `notes` is a slice of (pitch_class, weight) tuples.
    /// Fundamentals get 1.0, fifths ~0.8, thirds ~0.6.
    /// This better models real guitar string resonance.
    fn weighted(name: &'static str, notes: &[(usize, f32)]) -> Self {
        let mut profile = [0.0; 12];
        for &(pc, weight) in notes {
            profile[pc] = weight;
        }

        // Normalize
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
    //
    // Weights reflect real guitar voicings:
    //   Root = 1.0, Fifth = 0.85, Third = 0.65
    //   Doubled notes get a small boost.
    //   Open string bass notes that ring sympathetically are included at lower weight.

    vec![
        // A major: A(9) C#(1) E(4) - open voicing: x02220
        // Strings: A E A C# E (root doubled, fifth doubled)
        ChordTemplate::weighted("A", &[
            (9, 1.0),   // A root (doubled)
            (1, 0.65),  // C# third
            (4, 0.90),  // E fifth (doubled)
        ]),

        // C major: C(0) E(4) G(7) - open voicing: x32010
        // Strings: C E G C E (root doubled, fifth present)
        ChordTemplate::weighted("C", &[
            (0, 1.0),   // C root (doubled)
            (4, 0.85),  // E third (doubled)
            (7, 0.75),  // G fifth
        ]),

        // D major: D(2) F#(6) A(9) - open voicing: xx0232
        // Strings: D A D F# (root doubled)
        ChordTemplate::weighted("D", &[
            (2, 1.0),   // D root (doubled)
            (6, 0.65),  // F# third
            (9, 0.85),  // A fifth
        ]),

        // E major: E(4) G#(8) B(11) - open voicing: 022100
        // Strings: E B E G# B E (root tripled, fifth doubled)
        ChordTemplate::weighted("E", &[
            (4, 1.0),   // E root (tripled)
            (8, 0.60),  // G# third
            (11, 0.90), // B fifth (doubled)
        ]),

        // G major: G(7) B(11) D(2) - open voicing: 320003
        // Strings: G B D G B G (root tripled, fifth doubled)
        ChordTemplate::weighted("G", &[
            (7, 1.0),   // G root (tripled)
            (11, 0.85), // B third (doubled)
            (2, 0.70),  // D fifth
        ]),

        // Am: A(9) C(0) E(4) - open voicing: x02210
        // Strings: A E A C E (root doubled, fifth doubled)
        ChordTemplate::weighted("Am", &[
            (9, 1.0),   // A root (doubled)
            (0, 0.65),  // C minor third
            (4, 0.90),  // E fifth (doubled)
        ]),

        // Dm: D(2) F(5) A(9) - open voicing: xx0231
        // Strings: D A D F (root doubled)
        ChordTemplate::weighted("Dm", &[
            (2, 1.0),   // D root (doubled)
            (5, 0.65),  // F minor third
            (9, 0.85),  // A fifth
        ]),

        // Em: E(4) G(7) B(11) - open voicing: 022000
        // Strings: E B E G B E (root tripled, fifth doubled)
        ChordTemplate::weighted("Em", &[
            (4, 1.0),   // E root (tripled)
            (7, 0.65),  // G minor third
            (11, 0.90), // B fifth (doubled)
        ]),
    ]
}
