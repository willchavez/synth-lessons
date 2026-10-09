# Synth Lessons

A small, interactive browser app for learning synthesis alongside a Teenage Engineering OP-XY. Hear what a control changes, see it on a graph, and explore one idea at a time before putting everything together in a playable synth.

Built with plain HTML, CSS, JavaScript, Canvas, and the Web Audio API. No dependencies, installation, or build step required.

## Run locally

From the repository directory, start a static server:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Open these pages in a modern browser:

- **Lessons:** [localhost:8765](http://localhost:8765/)
- **Synth playground:** [localhost:8765/demo.html](http://localhost:8765/demo.html)

Click Play to enable audio. Serve the files over HTTP rather than opening them directly with `file://`: the audio worklets need a secure context, such as localhost or HTTPS.

## The lessons

| Lesson | What you explore |
| --- | --- |
| 01 · Filter | Cutoff, resonance, low-pass, high-pass, SVF, and ladder filters |
| 02 · Filter envelope | How ADSR moves cutoff over time; envelope amount controls how far it moves |
| 03 · Amp envelope | How ADSR shapes volume, from the start of a note to its fade-out |
| 04 · LFO | Repeating movement, with rate, amount, shape, and a destination |

Each lesson isolates its main idea and includes a listening experiment. Envelope stages are marked in blue (attack), amber (decay), green (sustain), and purple (release). Attack, decay, and release are times; sustain is a level.

## The synth playground

The playground combines a sound source, filter, filter envelope, amp envelope, and one LFO in a monophonic instrument.

- Choose saw, square, or sine waveforms.
- Try low-pass, high-pass, SVF (low-pass, band-pass, or high-pass), and ladder low-pass filters.
- Shape cutoff and volume independently with two ADSR envelopes.
- Send a sine or triangle LFO to cutoff, volume (tremolo), or pitch (vibrato).
- Start with **Pluck**, **Slow pad**, **LFO pulse**, or **Soft vibrato**, then adjust the controls.
- Watch both envelopes, the LFO, and the filter response while you play. The hatched region shows the filter envelope's range of movement.

Hold an on-screen key with a mouse or touch, then let go to hear release. Computer keyboard shortcuts cover C3–C4:

```text
Black keys:   W E   T Y U
White keys: A S D F G H J K
```

The **Play C3** button holds a note until you click it again to release it. **Stop all** cuts off playback with a short fade. Parameter changes, including envelope edits, apply to the current held note; keyboard shortcuts also work while sliders or closed dropdowns have focus.

## OP-XY connection

This is a learning companion inspired by the OP-XY, not an emulator. The SVF and ladder filters are simplified working models; their exact algorithms and sound differ from the hardware. The app focuses on a few useful LFO destinations rather than reproducing every source, destination, or instrument feature.

For the hardware's controls and behavior, see the [official OP-XY instrument guide](https://teenage.engineering/guides/op-xy/instrument).

## Project files

| File | Purpose |
| --- | --- |
| `index.html` | The four lessons, their controls, visualizations, and playback |
| `demo.html` | Playground layout and styling |
| `demo.js` | Playground controls, note handling, and live visualizations |
| `filter-dsp.js` | Shared SVF/ladder processing and filter-response math |
| `synth-voice.js` | Oscillator, envelopes, LFO, and combined synth voice |
| `synth-worklet.js` | AudioWorklet processor for playground audio |
| `tests/` | Audio DSP and playback regression checks |

## Run the tests

With Node.js installed, run:

```sh
node tests/playback.test.cjs
node tests/filter-dsp.test.cjs
node tests/demo-dsp.test.cjs
node tests/demo-controller.test.cjs
```

The tests cover filter response and stability, combined envelope/LFO audio, early release, live parameter changes, keyboard focus handling, and stop/replay behavior. They use Node's built-in modules and require no package installation. Browser listening and visual checks are still useful when changing the interface or sound.
