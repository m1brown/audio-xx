# GTM Phase 3 — 106-Prompt Benchmark

**Date:** 2026-07-15 · **Branch:** `launch-qa-responses` (= production code + the eight July-2 QA fixes) · **Rubric:** answered? / ChatGPT clearly better? / embarrassing? → Green/Red.

**Method notes:** LLM-lane responses (audio_knowledge, 31 prompts) are scored on routing + the lane's demonstrated prod quality (verified live on the Bluetooth deploy check); the harness captures only the scaffold. Five rows the harness sent to shopping actually reach the knowledge lane on prod (page.tsx dispatches `audio_knowledge` at line 3084, before shopping at 3592) and are scored as such.

## Totals

| | |
|---|---|
| Total prompts | **106** |
| Green | **50 (47%)** |
| Red | **56 (53%)** |

## Reds (one sentence each)

1. **SA-01** — Calls the same system "detail-first" and "harmonic richness and tonal density" in one document.
2. **SA-02** — Identity contradiction: "consistent lean toward detail emphasis" beside "favours fatigue resistance over analytical separation."
3. **SA-03** — Asks for "signal-flow order" of an obvious two-box system instead of assessing it.
4. **SA-04** — Says "no strong lean," then "warmth and body dominate," then "preference for neutrality."
5. **SA-05** — Still tells the Cornwall + Decware SET owner to CHANGE the amplifier — the one pairing where 2W is the point.
6. **SA-07** — Invents a premise ("you described the Qutest as a speaker") and asks instead of assessing.
7. **SA-08** — Engine returns null for Genelec/RME; no assessment at all.
8. **SA-09** — Four contradictory identities (microdetail/harmonic density/tone-first/precision) plus CHANGE-the-Nait-50.
9. **SA-12** — "Prioritising tonal density" and "balanced system with no dominant bias" in the same response.
10. **SA-13** — Asks for signal-flow order of an obvious turntable/DAC/amp/speaker starter system.
11. **SA-14** — "Rate my setup" (3 components) answered with a WiiM-only product card.
12. **UP-01** — Pedantic Node-is-a-streamer clarification instead of the DAC-vs-amp ranking asked for.
13. **UP-02** — "Weakest link?" answered with the contradictory identity-soup assessment rather than a named link.
14. **UP-06** — Node vs A8 upgrade question answered with a Node-only sheet; the A8 never appears.
15. **UP-07** — Yes/no streamer-audibility question answered with $4,200 and $12,500 DAC product cards.
16. **UP-08** — Sub-vs-speaker-upgrade question answered with $12,000 DeVore floorstanders.
17. **PD-04** — A8-vs-A6 worth-it question gets two empty sentences and a taste question.
18. **PD-07** — Cold "help me choose a dac" still anchors at $4,200 and $12,500.
19. **PD-09** — LS50 Meta vs original answered with a generic KEF brand card; the question is never addressed.
20. **SM-01** — "Can my Nait 50 drive LS3/5a?" never answers the power question and recommends changing the amp.
21. **SM-02** — XA25/LRS+ power question answered with a Pass Labs brand history.
22. **SM-03** — "Would Luxman pair well with Harbeth?" answered as a Luxman-vs-Harbeth rivalry instead of a pairing verdict.
23. **SM-04** — Amp for Klipsch Forte IV anchors on the $20,000 Shindo Cortese.
24. **TS-01** — Bright/harsh complaint answered with a Topping-vs-Elac "which should I buy" comparison.
25. **TS-03** — Weak-bass-in-big-room physics question answered with a KEF brand card.
26. **TS-04** — "What causes fatigue?" answered by asking whether it sounds fatiguing.
27. **TS-05** — Classic turntable ground-loop hum gets the generic symptom questionnaire instead of the classic answer.
28. **TS-06** — Loud-good/quiet-boring (Fletcher-Munson) gets the generic symptom questionnaire.
29. **PH-03** — "Streaming vs vinyl" routes to music_input and produces nothing.
30. **PH-04** — R2R vs delta-sigma answered with a one-line R2R capsule and no delta-sigma at all.
31. **EC-01** — Unknown products still produce nothing (known C4).
32. **EC-02** — Unpunctuated three-component system answered with a Hegel-only product card.
33. **EC-03** — Misspellings resolve, but the assessment contradicts itself (detail-first vs harmonic richness).
34. **EC-04** — French owner's Focal + Naim system pitted against itself as a versus choice.
35. **NT-01** — "$1500, sounds lifeless" answered by asking whether it sounds lifeless; budget ignored.
36. **NT-05** — Qutest-or-Pontus dilemma answered with a Pontus-only sheet.
37. **NT-08** — "Streamer or laptop?" answered with streamer product cards; the laptop half never addressed.
38. **NT-11** — 86dB Magnepans + power question still answered with a $20,000 SET recommendation.
39. **RS-02** — Acoustic-panel question routes to music_input and produces nothing.
40. **RS-03** — Boomy-corner complaint gets the generic questionnaire instead of the boundary-gain answer.
41. **RS-05** — Cable-length question routes to the cable lane unverified; no captured answer.
42. **LS-02** — "Best soundbar" produces an empty shopping response with a warm-vs-clean taste question.
43. **LS-03** — "AirPods Max worth it?" produces the same empty non-answer.
44. **LS-04** — "Record player with built-in speakers" answered with $12,000 DeVore O/96 floorstanders.
45. **LS-06** — "Headphones for the gym" answered with the $6,000 amp-requiring open-back HiFiMAN Susvara.
46. **CG-02** — "$5,000 total for speakers AND amp" answered with speaker picks up to $4,800 and no allocation.
47. **CG-04** — "$800, upgrade which of these three?" produces the empty non-answer.
48. **CG-06** — "Best used bargains" answered with the $20,000 Shindo Cortese.
49. **CN-06** — "Why does vinyl sound better" routes to music_input and produces nothing.
50. **BY-01** — "Isn't bright" constraint answered with picks described as "fast, articulate, clean, detailed."
51. **BY-02** — Phono preamp request answered with two integrated/power amplifiers.
52. **BG-05** — Integrated-vs-receiver beginner question routes to comparison and produces nothing.
53. **BG-06** — Built-in-DAC beginner question routes to intake and produces nothing.
54. **VG-02** — Misspelled "harbeht or proac" comparison produces nothing.
55. **VG-04** — "amp for kef ls50 meta pls" anchors on the $20,000 Shindo Cortese.
56. **VG-09** — "Getting into vinyl, where do I start" routes to music_input and produces nothing.

## Single worst red

**LS-04 — "I want a record player with built in speakers" → DeVore Orangutan O/96, $12,000.** A person asking for a suitcase turntable is offered twelve-thousand-dollar audiophile floorstanders — the purest possible screenshot of not listening, and the exact class of failure the Bluetooth fix addressed, one category over.
