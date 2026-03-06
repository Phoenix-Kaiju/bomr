# Mobile Dictation for BOM Inventory

Prepared for CTO review  
Date: 2026-03-06

## Executive Summary

If we remove OS-native recognizers and require offline, private, open-source speech-to-text on mobile, the realistic shortlist is small:

- `sherpa-ncnn` / `sherpa-onnx`
- `Vosk`
- `whisper.cpp`

Everything else is either too immature, too heavy, too stale, or too risky from a licensing/maintenance standpoint.

Blunt recommendation:

- Evaluate `sherpa-ncnn` first for the primary mobile path.
- Keep `Vosk` as the simpler fallback if we want a smaller, older, easier-to-reason-about stack.
- Keep `whisper.cpp` as the accuracy-first fallback for newer devices only, not as the default for the full mobile fleet.

## What Is Actually Possible

This is possible if the product flow is:

- user taps to dictate
- app records a short utterance on-device
- app transcribes on-device
- app extracts candidate inventory updates
- user confirms before the BOM is changed

This is not realistic if the product flow is:

- user speaks once
- app transcribes raw speech
- app writes inventory automatically with no confirmation

That will create inventory corruption. The failure mode is not rare edge cases. It is normal ASR behavior under noise, accents, rushed speech, brand names, and alphanumeric part identifiers.

## Decision Frame

We care about:

- offline and privacy first
- open source
- mobile RAM / CPU / battery constraints
- fast enough for short, occasional inventory updates
- maintainable licensing for commercial use

Under those constraints, the core tradeoff is simple:

- lower footprint and faster startup usually means lower robustness
- higher robustness usually means materially higher model size and runtime cost

## Shortlist Comparison

| Option | Why it is viable | Why it is risky | Assessment |
| --- | --- | --- | --- |
| `sherpa-ncnn` | Built for real-time/offline edge speech recognition, has Android/iOS support, VAD support, and a strong small-model story | More integration complexity than older wrapper-style toolkits; smaller ecosystem than Whisper | Best first candidate for constrained mobile |
| `Vosk` | Offline, mobile-capable, small models, streaming support, dynamic vocabulary support | Public release cadence is older; accuracy may fall off sooner on noisy or brand-heavy BOM speech | Strong fallback if we want pragmatic simplicity |
| `whisper.cpp` | Mature, active, good mobile support, good robustness, quantization, VAD, Apple acceleration paths | Heavier storage and RAM footprint; not the right default if low-end mobile performance is a hard constraint | Good fallback for higher-end devices or if accuracy wins |
| `Moonshine` | Fast-moving edge project with small English models and mobile examples | Non-English models are non-commercial; not clean enough as a general product bet | Do not choose unless scope is tightly English-only and legal signs off |

## Why `sherpa-ncnn` First

This is the best match for the constraints, not because it is universally best, but because it is the best fit for this specific problem:

- It is explicitly built around offline, real-time, edge-device speech recognition.
- It supports Android and iOS directly.
- It includes VAD support, which matters because BOM dictation should process short bursts, not long-form audio.
- The Sherpa docs expose very small streaming model variants, which is the right direction for constrained devices.
- Upstream maintenance is current. The latest `sherpa-ncnn` GitHub release is `v2.1.15`, published on 2025-09-16.

If the goal is "private, mobile, fast enough, not huge," this is the cleanest technical starting point.

## Why `Vosk` Still Matters

`Vosk` is not the most advanced option, but it remains relevant because it is practical:

- Official docs state a small model is typically around `50 MB` and uses about `300 MB` of memory.
- It supports offline recognition and dynamic vocabulary reconfiguration.
- It is easier to understand operationally than more experimental edge stacks.

The concern is not that `Vosk` is unusable. The concern is that it may lose on accuracy faster, especially on:

- equipment brand names
- unusual part names
- spoken alphanumeric identifiers
- noisy environments

Also, the latest listed GitHub release for `vosk-api` is `v0.3.50`, published on 2024-04-22. That does not make it dead, but it does make it the least reassuring maintenance signal in the shortlist.

## Why `whisper.cpp` Is Not The Default

`whisper.cpp` is the strongest robustness play in this set, but it is not the best default for constrained mobile:

- official model sizes are roughly `75 MiB` for `tiny`, `142 MiB` for `base`, and `466 MiB` for `small`
- it supports Android and iOS
- it supports quantization and VAD
- it has an active maintenance signal, with latest GitHub release `v1.8.3` published on 2026-01-15

The problem is straightforward:

- it is heavier to ship
- it is heavier to keep resident
- it is more likely to hurt startup latency, memory pressure, and battery on lower-end devices

For a mobile BOM update feature that is used intermittently, `whisper.cpp` makes sense only if pilot testing shows the lighter stacks are not accurate enough.

## What Is Available vs What Is Possible

Available means a real implementation exists today.

Possible means it can satisfy our product constraints without creating an unacceptable operational burden.

Examples:

- `whisper.cpp` is available and possible, but not ideal as the default mobile path.
- `Vosk` is available and possible, but accuracy risk is more material.
- `sherpa-ncnn` is available and possible, and best aligned with the offline mobile constraint set.
- fully automatic raw-speech-to-inventory writes are technically available to attempt, but not product-safe, so they are not realistically possible for a reliable BOM system.

## What Is Not Realistic

- No confirmation step before inventory mutation
- High confidence transcription of obscure model numbers spoken quickly in noisy spaces
- One engine that is simultaneously tiny, highly accurate, multilingual, commercially clean, and easy to integrate
- Continuous passive listening on mobile without battery and privacy concerns

## Main Risks

### Product Risk

The hardest input is not normal English. It is inventory language:

- model numbers
- serial-like identifiers
- vendor names
- abbreviations
- quantities and units

Speech-to-text engines are weakest exactly where BOM data is most fragile.

### Mobile Runtime Risk

If we choose too heavy a model:

- cold start becomes noticeable
- memory pressure increases
- battery and thermals become visible
- lower-end devices become second-class citizens

### Maintenance Risk

- `Vosk` has the weakest recent release signal in the shortlist
- `Moonshine` has licensing constraints that can become a commercial problem
- any edge ASR stack still requires domain evaluation; benchmarks are not enough

### Data Integrity Risk

Even with offline STT, the application still needs a second validation layer:

- parse quantities and nouns separately
- match candidate parts against known inventory records
- force user confirmation for ambiguous matches

Without that layer, the speech engine becomes the source of bad writes.

## Final Recommendation

Recommendation for decision:

1. Approve a short technical spike around `sherpa-ncnn` as the primary candidate.
2. Define success as: short push-to-talk utterances, on-device transcript, candidate item extraction, user confirmation, then BOM update.
3. Keep `Vosk` as the fallback if Sherpa integration cost is higher than expected or if a smaller operational surface is preferred.
4. Treat `whisper.cpp` as the fallback only if field accuracy on equipment terminology is materially better and the target device fleet can absorb the size/runtime cost.
5. Reject `Moonshine` for now unless product scope is strictly English-only and legal explicitly accepts the licensing posture.

If a single decision must be made now, the best current choice is:

**Start with `sherpa-ncnn`, not because it is perfect, but because it is the best fit for offline mobile constraints without immediately paying the full `whisper.cpp` cost.**

## Sources

- `whisper.cpp` repository: <https://github.com/ggml-org/whisper.cpp>
- `whisper.cpp` model sizes: <https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/models/README.md>
- OpenAI Whisper model card: <https://raw.githubusercontent.com/openai/whisper/main/model-card.md>
- `Vosk` repository: <https://github.com/alphacep/vosk-api>
- `Vosk` model catalog: <https://alphacephei.com/vosk/models>
- `sherpa-ncnn` repository: <https://github.com/k2-fsa/sherpa-ncnn>
- Sherpa small streaming model docs: <https://k2-fsa.github.io/sherpa/onnx/pretrained_models/small-online-models.html>
- `Moonshine` repository: <https://github.com/moonshine-ai/moonshine>
