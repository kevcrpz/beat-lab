/* Engine: the instruments, and how a song turns into sound. Every built-in
   instrument is made from scratch with the Web Audio API: oscillators (pure
   tones), noise, filters and volume envelopes. Nothing is downloaded.
   You don't need to edit this file. */

const Synth = (() => {
  // A note number → how many times a second the sound wave repeats (its frequency).
  // A4 (number 69) is 440 Hz, and every 12 notes up doubles the frequency.
  const freq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

  const noiseBuffers = new WeakMap();
  function noise(ctx, t, length) {
    if (!noiseBuffers.has(ctx)) {
      const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      noiseBuffers.set(ctx, b);
    }
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffers.get(ctx);
    src.start(t, Math.random() * 0.4);
    src.stop(t + length);
    return src;
  }

  // A quick "pluck" of volume: up fast, then fade away.
  function hit(gain, t, peak, attack, decay) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  // A held note: rise, settle to a level, hold while the note lasts, then fade.
  function hold(gain, t, len, peak, attack, sustain, release) {
    const a = Math.min(attack, len * 0.8);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + a);
    gain.gain.setTargetAtTime(peak * sustain, t + a, 0.08);
    gain.gain.setTargetAtTime(0, t + len, release / 3);
    return t + len + release * 2;
  }

  function osc(ctx, type, f, t, end, detune = 0) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.detune.value = detune;
    o.start(t);
    o.stop(end);
    return o;
  }

  // ---------- drums: (ctx, out, time, loudness) ----------
  const DRUM = {
    kick(ctx, out, t, v) {
      const g = ctx.createGain();
      const o = osc(ctx, "sine", 150, t, t + 0.5);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.13);
      hit(g, t, 0.95 * v, 0.003, 0.4);
      o.connect(g).connect(out);
      const cg = ctx.createGain();
      hit(cg, t, 0.12 * v, 0.001, 0.015);
      osc(ctx, "square", 1000, t, t + 0.03).connect(cg).connect(out);
    },
    snare(ctx, out, t, v) {
      const f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = "highpass"; f.frequency.value = 1300;
      hit(g, t, 0.5 * v, 0.002, 0.17);
      noise(ctx, t, 0.3).connect(f).connect(g).connect(out);
      const tg = ctx.createGain();
      const o = osc(ctx, "triangle", 230, t, t + 0.15);
      o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
      hit(tg, t, 0.4 * v, 0.002, 0.09);
      o.connect(tg).connect(out);
    },
    hat(ctx, out, t, v) {
      const f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = "highpass"; f.frequency.value = 7000;
      hit(g, t, 0.3 * v, 0.001, v > 1 ? 0.12 : 0.045);
      noise(ctx, t, 0.2).connect(f).connect(g).connect(out);
    },
    clap(ctx, out, t, v) {
      const f = ctx.createBiquadFilter();
      f.type = "bandpass"; f.frequency.value = 1400; f.Q.value = 0.8;
      f.connect(out);
      for (const [d, decay, peak] of [[0, 0.012, 0.6], [0.012, 0.012, 0.6], [0.025, 0.17, 0.75]]) {
        const g = ctx.createGain();
        hit(g, t + d, peak * v, 0.001, decay);
        noise(ctx, t + d, decay + 0.05).connect(g).connect(f);
      }
    },
    tom(ctx, out, t, v) {
      const g = ctx.createGain();
      const o = osc(ctx, "sine", 210, t, t + 0.45);
      o.frequency.exponentialRampToValueAtTime(105, t + 0.3);
      hit(g, t, 0.75 * v, 0.003, 0.35);
      o.connect(g).connect(out);
    },
  };

  // ---------- melody: (ctx, out, time, loudness, note number, seconds) ----------
  const MELODY = {
    bass(ctx, out, t, v, midi, len) {
      const f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = "lowpass"; f.Q.value = 3;
      f.frequency.setValueAtTime(1600, t);
      f.frequency.exponentialRampToValueAtTime(420, t + 0.25);
      const end = hold(g, t, len, 0.42 * v, 0.006, 0.8, 0.09);
      osc(ctx, "sawtooth", freq(midi), t, end).connect(f);
      osc(ctx, "sine", freq(midi), t, end).connect(g);
      f.connect(g).connect(out);
    },
    lead(ctx, out, t, v, midi, len) {
      const f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = "lowpass"; f.frequency.value = 3200; f.Q.value = 1.5;
      const end = hold(g, t, len, 0.18 * v, 0.012, 0.7, 0.14);
      for (const d of [-7, 7]) {
        const o = osc(ctx, "sawtooth", freq(midi), t, end, d);
        const vib = osc(ctx, "sine", 5.5, t, end);
        const depth = ctx.createGain();
        depth.gain.setValueAtTime(0, t);
        depth.gain.linearRampToValueAtTime(8, t + 0.35);
        vib.connect(depth).connect(o.detune);
        o.connect(f);
      }
      f.connect(g).connect(out);
    },
    pad(ctx, out, t, v, midi, len) {
      const f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = "lowpass"; f.frequency.value = 1500;
      const end = hold(g, t, len, 0.09 * v, 0.3, 0.85, 0.7);
      osc(ctx, "sawtooth", freq(midi), t, end, -9).connect(f);
      osc(ctx, "sawtooth", freq(midi), t, end, 9).connect(f);
      osc(ctx, "triangle", freq(midi) / 2, t, end).connect(f);
      f.connect(g).connect(out);
    },
    pluck(ctx, out, t, v, midi, len) {
      const f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = "lowpass";
      f.frequency.setValueAtTime(5000, t);
      f.frequency.exponentialRampToValueAtTime(700, t + 0.3);
      const ring = Math.max(0.35, Math.min(1.2, len + 0.25));
      hit(g, t, 0.32 * v, 0.003, ring);
      osc(ctx, "triangle", freq(midi), t, t + ring + 0.05).connect(f);
      const hg = ctx.createGain();
      hit(hg, t, 0.12 * v, 0.002, 0.15);
      osc(ctx, "sine", freq(midi) * 3, t, t + 0.2).connect(hg).connect(f);
      f.connect(g).connect(out);
    },
  };

  // Your own sound, played at its own pitch, or higher or lower for a note
  // (C4 is the sound's own pitch, C5 is twice as fast and an octave up).
  function sample(ctx, out, t, v, buffer, midi) {
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = buffer;
    if (midi != null) src.playbackRate.value = Math.pow(2, (midi - 60) / 12);
    g.gain.value = 0.9 * v;
    src.connect(g).connect(out);
    src.start(t);
  }

  // Everything plays into this: a volume knob, then a "compressor" that
  // turns loud moments down, then a soft limit so the wave never goes past
  // the edge (which would sound crackly), then the speakers. The analyser
  // lets the page draw the sound wave.
  let curve = null;
  function chain(ctx, destination) {
    const input = ctx.createGain();
    input.gain.value = 0.5;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.2;
    if (!curve) {
      curve = new Float32Array(2049);
      for (let i = 0; i < curve.length; i++) {
        const x = (i / 1024 - 1) * 2;
        curve[i] = Math.abs(x) < 0.6 ? x : Math.sign(x) * (0.6 + 0.38 * Math.tanh((Math.abs(x) - 0.6) / 0.38));
      }
    }
    const limit = ctx.createWaveShaper();
    limit.curve = curve;
    const pre = ctx.createGain(), post = ctx.createGain();
    pre.gain.value = 0.5;   // the curve covers -2..2, so squeeze the signal into it
    post.gain.value = 1;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    input.connect(comp);
    comp.connect(pre);
    pre.connect(limit);
    limit.connect(post);
    post.connect(destination);
    post.connect(analyser);
    return { input, analyser };
  }

  // One output per instrument, with that instrument's volume: setting.
  function outputs(ctx, into, song) {
    const outs = {};
    return (inst) => {
      if (!outs[inst]) {
        outs[inst] = ctx.createGain();
        outs[inst].gain.value = song.volumes[inst] ?? 1;
        outs[inst].connect(into);
      }
      return outs[inst];
    };
  }

  // Plays every instrument's sound for one step of one section.
  function playStep(ctx, outFor, song, secName, step, t, stepLen, buffers, muted) {
    const sec = song.sections[secName];
    if (!sec) return;
    for (const row of sec.rows) {
      if (!row.kind || (muted && muted(row.inst))) continue;
      const cell = row.cells[step];
      if (!cell || cell === "hold") continue;
      if (row.kind === "drum") DRUM[row.inst](ctx, outFor(row.inst), t, cell.vel);
      else if (row.kind === "melodic") for (const m of cell.notes) MELODY[row.inst](ctx, outFor(row.inst), t, cell.vel, m, cell.len * stepLen);
      else {
        const s = song.sounds[row.inst];
        const buf = s && buffers[s.src];
        if (buf) for (const m of cell.notes || [null]) sample(ctx, outFor(row.inst), t, cell.vel, buf, m);
      }
    }
  }

  // Swing: every second step comes a little late, which makes it bounce.
  const swingDelay = (song, step) => (step % 2 ? (song.swing / 100) * (60 / song.tempo / 4) : 0);

  // Plays one note on its own (the editor uses this when you pick a note).
  function preview(ctx, into, inst, midi, buffers, song) {
    const t = ctx.currentTime + 0.02;
    if (DRUM[inst]) DRUM[inst](ctx, into, t, 1);
    else if (MELODY[inst]) MELODY[inst](ctx, into, t, 1, midi ?? 60, 0.35);
    else if (song && song.sounds[inst] && buffers[song.sounds[inst].src]) sample(ctx, into, t, 1, buffers[song.sounds[inst].src], midi);
  }

  const TAIL = 2; // seconds of ringing after the last step

  // Makes the whole song at once, faster than real time, into a block of
  // numbers (samples) that can be saved as a WAV file.
  async function render(song, buffers, sampleRate = 44100) {
    const stepLen = 60 / song.tempo / 4;
    const length = Math.ceil((song.sequence.length * song.steps * stepLen + TAIL) * sampleRate);
    const ctx = new OfflineAudioContext(2, length, sampleRate);
    const main = chain(ctx, ctx.destination);
    const outFor = outputs(ctx, main.input, song);
    let n = 0;
    for (const secName of song.sequence) {
      for (let step = 0; step < song.steps; step++, n++) {
        playStep(ctx, outFor, song, secName, step, n * stepLen + swingDelay(song, step) + 0.005, stepLen, buffers);
      }
    }
    return ctx.startRendering();
  }

  // A WAV file is a short header followed by every sample as a whole number.
  function wav(audio) {
    const ch = audio.numberOfChannels, n = audio.length, rate = audio.sampleRate;
    const buf = new ArrayBuffer(44 + n * ch * 2), view = new DataView(buf);
    const text = (at, s) => { for (let i = 0; i < s.length; i++) view.setUint8(at + i, s.charCodeAt(i)); };
    text(0, "RIFF"); view.setUint32(4, 36 + n * ch * 2, true); text(8, "WAVE");
    text(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, ch, true);
    view.setUint32(24, rate, true); view.setUint32(28, rate * ch * 2, true); view.setUint16(32, ch * 2, true); view.setUint16(34, 16, true);
    text(36, "data"); view.setUint32(40, n * ch * 2, true);
    const data = [];
    for (let c = 0; c < ch; c++) data.push(audio.getChannelData(c));
    let at = 44;
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < ch; c++) {
        const s = Math.max(-1, Math.min(1, data[c][i]));
        view.setInt16(at, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        at += 2;
      }
    }
    return new Blob([buf], { type: "audio/wav" });
  }

  // Turns an uploaded sound file into samples the browser can play.
  async function decode(arrayBuffer) {
    const ctx = new OfflineAudioContext(1, 1, 44100);
    return ctx.decodeAudioData(arrayBuffer);
  }

  return { chain, outputs, playStep, swingDelay, preview, render, wav, decode, freq, TAIL };
})();
