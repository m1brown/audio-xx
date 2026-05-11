# R2R ladder conversion — topology, behavior, and contested audibility

**Status:** Educational reference, draft v1.
**Authority:** product author (Mike). Engineering may reference but not modify.
**Scope:** explains R2R ladder digital-to-analog conversion, its measurable behavior, its perceptual reception, and the unresolved gap between sighted-listening consensus and controlled blind-testing evidence.

---

## Topology

An R2R ladder DAC converts a digital code into an analog voltage by combining a resistor network with bit-controlled switches. The name refers to the use of two resistor values — one of value R and one of value 2R — arranged so that each bit of the input switches its node between a reference voltage and ground. The voltage-divider behavior of the ladder produces a binary-weighted analog summation: the output voltage corresponds to the analog sum of all bits weighted by position.

This contrasts with delta-sigma conversion, in which a low-bit (often 1-bit) quantizer at a very high oversampling rate produces a density-coded stream that is decoded to multibit output after noise shaping and digital filtering. R2R operates in the multibit domain directly; delta-sigma reconstructs multibit information from oversampled low-bit data.

## Measurable behavior

R2R audio-band performance is bounded by **resistor matching**. Each resistor must match its theoretical value; mismatch produces integral and differential nonlinearity (INL, DNL). MSB resistors matter most — mismatches there produce harmonic distortion at higher signal amplitudes. Hand-selected or laser-trimmed resistors are common at higher tiers, but matching tolerance practically limits effective resolution. Many discrete R2R DACs achieve roughly 17–19 bits of usable analog resolution despite accepting 24-bit input.

Delta-sigma escapes this constraint by avoiding precision analog matching, but introduces its own artifacts: noise-shaping residue above the audio band, low-level quantizer behavior, and digital filter ringing. Well-designed examples of both topologies typically achieve in-band THD+N below the threshold of common audibility research. Delta-sigma usually posts lower THD+N specifications; R2R typically shows different distortion-versus-level curves, with distortion components that scale with signal amplitude in characteristic ways.

## Oversampling versus NOS

Some R2R DACs operate non-oversampling (NOS), holding each input sample as analog voltage without digital interpolation. Others oversample (OS), generating intermediate samples digitally before conversion.

NOS produces image content close to the audio band — at 44.1 kHz input, the first image begins immediately above 22.05 kHz. The analog reconstruction filter must either roll off steeply (introducing phase distortion in the audio band) or let some image content through. NOS also produces a sin(x)/x amplitude rolloff approaching Nyquist — approximately −3.9 dB at 22.05 kHz from a 44.1 kHz source — unless digitally corrected.

Oversampling shifts the first image far above the audio band, allowing gentler analog filters with less audio-band phase distortion. The cost is digital-filter behavior: pre-ringing and post-ringing on impulses, with different filter designs (linear phase, minimum phase, slow rolloff, fast rolloff) producing different impulse responses.

Neither approach is universally preferable. They optimize different aspects of conversion behavior, and the audibility of the resulting differences is itself contested (see below).

## Listener perception

Sighted listening consistently reports differences between R2R and delta-sigma DACs, typically described as differences in transient character, tonal weight, and presentation of sustained tones. The reports are stable across decades and across reviewers.

## Contested audibility

Controlled blind comparisons — level-matched within tight tolerance, time-aligned, with short A/B switching — frequently show smaller or null differences than sighted listening suggests. The discrepancy is real and unresolved.

Several factors plausibly contribute. Level matching at the required precision is technically demanding; sub-0.1 dB differences can drive perception. Short A/B switching may not be the right paradigm for perceiving differences that emerge over longer listening windows. Cognitive load in blind testing changes attention patterns. Confirmation bias in sighted listening is well-documented. The reverse case — that some real perceptual differences are not captured by short A/B paradigms — is also defensible.

The honest position: in-band measurement differences between competently designed R2R and competently designed delta-sigma DACs are typically small; perceptual differences reported in sighted listening are typically larger than blind testing reveals; the resolution of this gap is an open question in audio research, not a settled one.

---

## What this does NOT establish

- That R2R is superior or inferior to delta-sigma.
- That topology choice predicts listener preference.
- That R2R DACs are categorically "more analog," "more musical," or "more natural" — these are perception claims without operational referents.
- That audible differences between the two topologies are zero. Null results in narrow blind-test paradigms do not prove inaudibility under all listening conditions.
- That audible differences are large. Sighted-listening consensus does not constitute controlled evidence.
- That a particular R2R or delta-sigma implementation behaves like its topology class generically. Implementation quality dominates topology choice for in-band performance.

---

## Suggested citations and references

- Dan Lavry, *Sampling Theory for Digital Audio* — overview of conversion fundamentals from a respected designer.
- Malcolm Hawksford, AES papers on DAC topologies (notably mid-1990s onward) — peer-reviewed treatment of ladder versus delta-sigma trade-offs.
- John Atkinson, Stereophile measurement archive — methodologically consistent measurements of R2R and delta-sigma DACs across decades.
- Schiit Audio *Multibit* technical papers — manufacturer-perspective explanation of the R2R/multibit case. Read for engineering content; conclusions are not neutral.
- Holo Audio published design notes — same caveat as above.
- Audio Science Review measurement threads — measurement data is reliable; interpretive framing is contested and should be read as one position among several.
- Floyd Toole, *Sound Reproduction: The Acoustics and Psychoacoustics of Loudspeakers and Rooms* — for audibility-threshold research methodology.
- AES Convention papers on DAC measurement methodology and the audibility of distortion components.
