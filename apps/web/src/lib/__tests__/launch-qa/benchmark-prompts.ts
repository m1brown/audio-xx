/**
 * Launch QA — Response Benchmark prompt set (branch: launch-qa-responses).
 *
 * ~85 representative user prompts across the eight categories in Mike's
 * launch-QA protocol, plus ~25 naturally-phrased prompts written the way
 * audiophiles actually type — vague, incomplete, conversational, typo'd.
 *
 * Read-only data. The harness (run-benchmark.test.ts) routes each prompt
 * through the deterministic engine exactly once, single-turn, guest state.
 */

export interface BenchmarkPrompt {
  id: string;
  category:
    | 'system_assessment'
    | 'upgrade'
    | 'purchase'
    | 'speaker_matching'
    | 'troubleshooting'
    | 'philosophy'
    | 'beginner'
    | 'edge_case'
    | 'natural';
  prompt: string;
  /** What a first-time visitor would reasonably expect back. */
  expectation: string;
}

export const BENCHMARK_PROMPTS: BenchmarkPrompt[] = [
  // ── 1. System assessments (highest priority) ─────────────────────────
  { id: 'SA-01', category: 'system_assessment', prompt: 'Assess my system: Harbeth SHL5+, Hegel H190, Bluesound Node', expectation: 'Coherent read of a warm-speaker/neutral-amp/budget-streamer chain; streamer named as the value outlier without snobbery.' },
  { id: 'SA-02', category: 'system_assessment', prompt: 'Assess my system: WLM Diva monitor, Job Integrated, Eversolo DMP-A6', expectation: 'The France system — balanced verdict, coherence explained.' },
  { id: 'SA-03', category: 'system_assessment', prompt: 'Assess my system: KEF LS50 Meta, NAD C3050', expectation: 'Honest read of a compact modern pairing; power adequacy addressed.' },
  { id: 'SA-04', category: 'system_assessment', prompt: 'Assess my system: Focal Sopra No.2, Luxman L-509Z', expectation: 'High-end pairing read; refinement vs energy trade named.' },
  { id: 'SA-05', category: 'system_assessment', prompt: 'Assess my system: Klipsch Cornwall IV, Decware SE84UFO', expectation: 'High-sensitivity + SET synergy recognized as deliberate, not flagged as a power problem.' },
  { id: 'SA-06', category: 'system_assessment', prompt: 'Assess my system: Magnepan 1.7i, Benchmark AHB2', expectation: 'Planar + clean-power read; honest about power headroom limits.' },
  { id: 'SA-07', category: 'system_assessment', prompt: 'Assess my system: ATC SCM40A active speakers with a Chord Qutest', expectation: 'Active-speaker chain understood — no amplifier advice.' },
  { id: 'SA-08', category: 'system_assessment', prompt: 'Assess my system: Genelec 8341A monitors, RME ADI-2 DAC', expectation: 'Studio-accuracy chain respected on its own terms.' },
  { id: 'SA-09', category: 'system_assessment', prompt: 'Assess my system: Linn LP12, Naim Nait 50, Falcon LS3/5a', expectation: 'Classic British system — heritage recognized, bass/scale limits stated honestly.' },
  { id: 'SA-10', category: 'system_assessment', prompt: 'Assess my system: Denafrips Pontus II, Leben CS600X, DeVore O/96', expectation: 'The pinned demo system — tone-first chain, coherence explained.' },
  { id: 'SA-11', category: 'system_assessment', prompt: 'Assess my system: Topping D90SE, Purifi Eigentakt amp, Revel M126Be', expectation: 'Measurement-first chain read fairly — not dismissed as sterile.' },
  { id: 'SA-12', category: 'system_assessment', prompt: 'What do you think of this system? Rega Planar 6 → Rega Aethos → Harbeth C7ES-3', expectation: 'Analog-first British chain; PRaT + midrange synergy named.' },

  // ── 2. Upgrade questions ──────────────────────────────────────────────
  { id: 'UP-01', category: 'upgrade', prompt: 'Should I upgrade my DAC or my amplifier first? I have a Bluesound Node into a Marantz PM8006 into KEF R3.', expectation: 'A ranked answer with reasoning, not a questionnaire.' },
  { id: 'UP-02', category: 'upgrade', prompt: 'What is the weakest link in my system: Eversolo DMP-A6, Job Integrated, WLM Diva monitor?', expectation: 'Names one component with a mechanism, or honestly says the system is balanced.' },
  { id: 'UP-03', category: 'upgrade', prompt: 'Where should I spend $2,000 to improve my system? Chord Qutest, Naim SuperNait 3, Harbeth SHL5+.', expectation: 'Direction with trade-offs; "keep what you have" allowed if honest.' },
  { id: 'UP-04', category: 'upgrade', prompt: 'Should I just keep what I have? Denafrips Ares II, Rega Brio, Wharfedale Linton.', expectation: 'A real verdict either way — decisive, not hedged.' },
  { id: 'UP-05', category: 'upgrade', prompt: 'What would you upgrade first?', expectation: 'Graceful handling of a system-less question — asks for the chain without feeling like a form.' },
  { id: 'UP-06', category: 'upgrade', prompt: 'Is it worth upgrading from a Bluesound Node to an Eversolo A8?', expectation: 'Honest incremental-gain read; names what actually changes.' },

  // ── 3. Purchase decisions ─────────────────────────────────────────────
  { id: 'PD-01', category: 'purchase', prompt: 'Chord Qutest vs Schiit Bifrost 2/64 — which should I buy?', expectation: 'Character contrast (FPGA clarity vs R2R density), pick guidance by taste.' },
  { id: 'PD-02', category: 'purchase', prompt: 'Holo May vs Schiit Yggdrasil', expectation: 'Two R2R flagships distinguished credibly.' },
  { id: 'PD-03', category: 'purchase', prompt: 'KEF R3 vs Harbeth P3ESR for a small room', expectation: 'Modern precision vs BBC midrange framed as a taste fork; room factored in.' },
  { id: 'PD-04', category: 'purchase', prompt: 'Is the Eversolo A8 worth it over the A6?', expectation: 'Honest same-brand tier comparison.' },
  { id: 'PD-05', category: 'purchase', prompt: 'What do you know about the LAiV Harmony DAC?', expectation: 'Either real knowledge or an honest "reasoning from type" hedge — no fabrication.' },
  { id: 'PD-06', category: 'purchase', prompt: 'best DAC under $1000', expectation: 'Ranked shortlist with real photos and a rationale per pick.' },
  { id: 'PD-07', category: 'purchase', prompt: 'help me choose a dac', expectation: 'Shopping mode (regression check on the July-1 intent fix) — not the diagnostic clarification.' },

  // ── 4. Speaker matching ───────────────────────────────────────────────
  { id: 'SM-01', category: 'speaker_matching', prompt: 'Can my Naim Nait 50 drive Falcon LS3/5a speakers?', expectation: 'Sensible power-match answer (low-sensitivity mini-monitor, modest watts, small-room verdict).' },
  { id: 'SM-02', category: 'speaker_matching', prompt: 'Is a Pass XA25 enough power for Magnepan LRS+?', expectation: 'Honest "marginal" answer — planars want current; Class A helps but SPL ceiling is real.' },
  { id: 'SM-03', category: 'speaker_matching', prompt: 'Would a Luxman integrated pair well with Harbeth speakers?', expectation: 'Classic pairing — warm-refined synergy affirmed with a real mechanism.' },
  { id: 'SM-04', category: 'speaker_matching', prompt: 'What amplifier should I buy for Klipsch Forte IV?', expectation: 'High-sensitivity guidance — low-watt tube/Class A options legitimate.' },

  // ── 5. Troubleshooting ────────────────────────────────────────────────
  { id: 'TS-01', category: 'troubleshooting', prompt: 'My system sounds bright and harsh. Topping DX7 Pro, NAD C316BEE, Elac Debut 2.0.', expectation: 'Mechanism-first diagnosis; names the likely contributor; room acknowledged.' },
  { id: 'TS-02', category: 'troubleshooting', prompt: 'Voices sound recessed and distant on my system.', expectation: 'Sensible triage questions or mechanism hypotheses — not generic filler.' },
  { id: 'TS-03', category: 'troubleshooting', prompt: 'Why is my bass so weak? KEF LS50 on stands in a large living room.', expectation: 'Physics honesty — small sealed monitor in a big room; placement + sub guidance.' },
  { id: 'TS-04', category: 'troubleshooting', prompt: 'I get listening fatigue after 30 minutes. What causes that?', expectation: 'Credible fatigue mechanism list (treble energy, distortion, level); actionable next step.' },

  // ── 6. Philosophy ─────────────────────────────────────────────────────
  { id: 'PH-01', category: 'philosophy', prompt: 'Do cables actually matter?', expectation: 'A grown-up answer with a point of view — neither cable-denial nor snake oil.' },
  { id: 'PH-02', category: 'philosophy', prompt: 'Is room treatment more important than electronics?', expectation: 'Clear hierarchy opinion with reasoning.' },
  { id: 'PH-03', category: 'philosophy', prompt: 'Is streaming as good as vinyl?', expectation: 'Frames it as presentation difference not fidelity war; has a stance.' },
  { id: 'PH-04', category: 'philosophy', prompt: 'What is the difference between R2R and delta-sigma DACs?', expectation: 'Accurate, hearable-difference-focused explanation.' },
  { id: 'PH-05', category: 'philosophy', prompt: 'Why do tube amps sound different from solid state?', expectation: 'Mechanism-grounded (harmonic profile, damping, clipping) without myth.' },

  // ── 7. Beginner ───────────────────────────────────────────────────────
  { id: 'BG-01', category: 'beginner', prompt: 'Build me a $3,000 system from scratch', expectation: 'A concrete starter system with allocation logic — not a questionnaire wall.' },
  { id: 'BG-02', category: 'beginner', prompt: 'What should I look for in my first turntable?', expectation: 'Practical guidance (cartridge, phono stage, isolation) at beginner altitude.' },
  { id: 'BG-03', category: 'beginner', prompt: 'What does speaker sensitivity mean?', expectation: 'Clear explanation with a practical consequence (amp matching).' },
  { id: 'BG-04', category: 'beginner', prompt: 'Are expensive speakers actually better?', expectation: 'Honest diminishing-returns answer with a point of view.' },

  // ── 8. Edge cases ─────────────────────────────────────────────────────
  { id: 'EC-01', category: 'edge_case', prompt: 'Assess my system: Fooblaster 9000, Sonic Deathray Mk II', expectation: 'Graceful unknown-product handling — no fabricated traits, no crash, useful next step.' },
  { id: 'EC-02', category: 'edge_case', prompt: 'harbeth shl5 plus hegel h190 bluesound node thoughts', expectation: 'Same as SA-01 despite no punctuation or "assess" verb.' },
  { id: 'EC-03', category: 'edge_case', prompt: 'assess my system: harbeth schl5+, hegal h190', expectation: 'Misspellings (schl5, hegal) resolved or gracefully flagged.' },
  { id: 'EC-04', category: 'edge_case', prompt: 'Que penses-tu de mon système? Focal Aria 906 avec un ampli Naim', expectation: 'Mixed-language input — either handles it or degrades gracefully in English.' },
  { id: 'EC-05', category: 'edge_case', prompt: 'Assess my system: just a pair of KEF LS50s', expectation: 'Incomplete system — asks the right single question or assesses what exists.' },
  { id: 'EC-06', category: 'edge_case', prompt: 'my system is a Sondek and a Nait and some Kans', expectation: 'Colloquial product names (LP12/Nait/Kan) recognized or gracefully queried.' },

  // ── 9. Natural — how audiophiles actually type ────────────────────────
  { id: 'NT-01', category: 'natural', prompt: 'ok so I have about $1500 and my system sounds kind of lifeless, not sure if it\'s the amp or what', expectation: 'Reads the mixed diagnose+budget intent; answers before interrogating.' },
  { id: 'NT-02', category: 'natural', prompt: 'everyone on reddit says buy a miniDSP Flex, do I need one?', expectation: 'A point of view on DSP-in-the-chain, not a shrug.' },
  { id: 'NT-03', category: 'natural', prompt: 'wife says the speakers are too big. something small that still sounds good?', expectation: 'Compact-speaker guidance with real picks; warmth about the constraint.' },
  { id: 'NT-04', category: 'natural', prompt: 'is class D finally good', expectation: 'Current honest read on Purifi/Hypex-era Class D.' },
  { id: 'NT-05', category: 'natural', prompt: 'I keep switching between my Qutest and my Pontus and I honestly can\'t decide which I like', expectation: 'Names the actual character fork and gives permission to pick one.' },
  { id: 'NT-06', category: 'natural', prompt: 'what would you pair with cornwalls', expectation: 'High-sensitivity amp guidance; lowercase informal input handled.' },
  { id: 'NT-07', category: 'natural', prompt: 'thinking about selling my hegel for a leben, am I crazy', expectation: 'The real trade (control vs tone) named; a stance taken.' },
  { id: 'NT-08', category: 'natural', prompt: 'do i need a streamer or can i just use my laptop', expectation: 'Honest answer about when a streamer matters.' },
  { id: 'NT-09', category: 'natural', prompt: 'whats a good tube amp that wont blow up my budget', expectation: 'Affordable tube picks with honest expectations.' },
  { id: 'NT-10', category: 'natural', prompt: 'speakers for a desk setup, mostly listening at low volume', expectation: 'Nearfield + low-level-listening guidance (sensitivity, tonal balance at low SPL).' },
  { id: 'NT-11', category: 'natural', prompt: 'I have Maggies and everyone says I need more power but the ones I hear with big amps sound worse to me', expectation: 'Takes the listener\'s observation seriously; explains what they may be hearing.' },
  { id: 'NT-12', category: 'natural', prompt: 'honestly just tell me if the LS50 meta is overhyped', expectation: 'Direct verdict with reasoning — no fence-sitting.' },
];
