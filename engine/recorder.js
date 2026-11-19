/* Engine: "Record a sound". Records a few seconds from the microphone, trims
   the silence at the start, and saves it as a .wav file you can upload to
   the sounds folder. Nothing is sent anywhere: it all happens in your browser.
   You don't need to edit this file. */

const Recorder = (() => {
  const MAX_SECONDS = 3;
  let rec = null; // { media, chunks, stream, timer }
  let made = null; // { buffer, blob }

  function open() {
    made = null;
    const body = document.createElement("div");
    body.className = "draft-form";
    body.innerHTML = `
      <p>Record a short sound (up to ${MAX_SECONDS} seconds): a clap, a word, a pencil tap, your dog. The silence at the start is trimmed off for you.
        Nothing leaves your computer until you upload it yourself.</p>
      <div class="draft-buttons"><button type="button" id="rec-go">● Record</button><button type="button" id="rec-play" disabled>▶ Listen</button></div>
      <p id="rec-status" class="rec-status">Your browser will ask to use the microphone.</p>
      <div id="rec-save" hidden>
        <label>Name it: <input type="text" id="rec-name" value="my-sound" spellcheck="false"> <span class="rec-ext">.wav</span></label>
        <div class="draft-buttons"><button type="button" id="rec-download">Download the .wav file</button></div>
        <ol>
          <li>On GitHub, open the <code>sounds</code> folder → <strong>Add file</strong> → <strong>Upload files</strong>, and drop in the file you downloaded.</li>
          <li>Commit it as a pull request.</li>
          <li>Add this line near the top of your song: <code id="rec-line"></code><br>Then rows like <code id="rec-row"></code> play it.</li>
        </ol>
      </div>`;
    const $ = (id) => body.querySelector("#" + id);
    $("rec-go").onclick = () => (rec ? finish() : begin($));
    $("rec-play").onclick = () => { if (made) { const a = new Audio(URL.createObjectURL(made.blob)); a.play(); } };
    const name = $("rec-name");
    const clean = () => (name.value.toLowerCase().trim().replace(/\.wav$/, "").replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "my-sound");
    const showLines = () => {
      const n = clean();
      $("rec-line").textContent = `sound: ${n} = sounds/${n}.wav`;
      $("rec-row").textContent = `${n}: x . . . | x . . .`;
    };
    name.oninput = showLines;
    showLines();
    $("rec-download").onclick = () => {
      if (!made) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(made.blob);
      a.download = clean() + ".wav";
      document.body.appendChild(a);
      a.click();
      a.remove();
      Recorder.last = { name: a.download, size: made.blob.size, seconds: made.buffer.duration };
    };
    App.openPanel("Record a sound", body);
  }

  async function begin($) {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      $("rec-status").textContent = "The microphone isn't available. Check that your browser is allowed to use it (the icon at the left of the address bar), then try again.";
      return;
    }
    const media = new MediaRecorder(stream);
    rec = { media, stream, chunks: [], $ };
    media.ondataavailable = (e) => { if (e.data.size) rec.chunks.push(e.data); };
    media.onstop = () => done();
    media.start();
    rec.timer = setTimeout(finish, MAX_SECONDS * 1000);
    $("rec-go").textContent = "■ Stop";
    $("rec-status").textContent = "Recording… make your sound now.";
  }

  function finish() {
    if (!rec) return;
    clearTimeout(rec.timer);
    if (rec.media.state !== "inactive") rec.media.stop();
  }

  async function done() {
    const { chunks, stream, $ } = rec;
    rec = null;
    stream.getTracks().forEach((t) => t.stop());
    $("rec-go").textContent = "● Record again";
    try {
      const decoded = await Synth.decode(await new Blob(chunks).arrayBuffer());
      const buffer = trim(decoded);
      made = { buffer, blob: Synth.wav(buffer) };
      $("rec-status").textContent = `Got ${buffer.duration.toFixed(2)} seconds of sound (${buffer.length.toLocaleString()} samples). Listen to it, then download it.`;
      $("rec-play").disabled = false;
      $("rec-save").hidden = false;
    } catch (e) {
      $("rec-status").textContent = "That recording couldn't be read. Try again.";
    }
  }

  // Cuts the quiet part at the start (so the sound isn't late) and makes it
  // one channel, with a tiny fade at the end so it doesn't click.
  function trim(buf) {
    const data = buf.getChannelData(0);
    let peak = 0;
    for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
    const threshold = Math.max(0.02, peak * 0.1);
    let start = 0;
    while (start < data.length && Math.abs(data[start]) < threshold) start++;
    start = Math.max(0, start - Math.round(buf.sampleRate * 0.005));
    const length = Math.max(1, data.length - start);
    const out = new AudioBuffer({ numberOfChannels: 1, length, sampleRate: buf.sampleRate });
    const o = out.getChannelData(0);
    const gain = peak > 0 ? Math.min(4, 0.9 / peak) : 1;
    const fade = Math.min(length, Math.round(buf.sampleRate * 0.02));
    for (let i = 0; i < length; i++) o[i] = data[start + i] * gain * (i > length - fade ? (length - i) / fade : 1);
    return out;
  }

  return { open, last: null };
})();
