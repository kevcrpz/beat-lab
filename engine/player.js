/* Engine: the album page and the player. Loads album.txt, songs/list.txt and
   every song, shows each section as a grid of steps, and plays the song by
   scheduling every sound a moment before it's due.
   You don't need to edit this file. */

const App = (() => {
  const $ = (id) => document.getElementById(id);
  const S = {
    live: null,          // { album, list, songs: { "name.txt": text } } as they are on the website
    over: {},            // songs changed in this browser (by the editor or a draft): name → text
    undo: {},            // name → earlier versions, for the Undo button
    extra: null,         // a draft song that isn't on the track list
    built: null,         // what Beat.build made of it all
    sel: 0, section: null, editing: false,
    sounds: {},          // sound file → "loading" | "ok" | "missing" | "bad"
    buffers: {},         // sound file → decoded samples
    coverBad: false,
    muted: new Set(), solo: new Set(),
  };
  const A = { ctx: null, main: null, session: null, timer: null };
  const PALETTES = {
    midnight: ["#1b1f4b", "#ff5fa2", "#5ad1ff", "#ffd166"],
    sunset: ["#f76707", "#c2255c", "#ffd43b", "#fff4e6"],
    lagoon: ["#0b7a75", "#3bc9db", "#b197fc", "#e6fcf5"],
    daylight: ["#1c64f2", "#e8590c", "#40c057", "#f8f9fa"],
  };

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const tracks = () => (S.built ? S.built.tracks : []);
  const current = () => tracks()[S.sel] || null;

  // ---------- loading ----------

  async function get(path) {
    try {
      const r = await fetch(path + "?v=" + Date.now());
      return r.ok ? await r.text() : null;
    } catch (e) {
      return null;
    }
  }

  async function load() {
    const [album, list] = await Promise.all([get("album.txt"), get("songs/list.txt")]);
    const names = Beat.build({ album: "", list, songs: {} }).list.map((t) => t.name);
    const texts = await Promise.all(names.map((n) => get("songs/" + n)));
    const songs = {};
    names.forEach((n, i) => { songs[n] = texts[i]; });
    return { album, list, songs };
  }

  function rebuild() {
    const L = S.live;
    const songs = Object.assign({}, L.songs);
    for (const [name, text] of Object.entries(S.over)) if (name in songs) songs[name] = text;
    S.built = Beat.build({ album: L.album, list: L.list, songs });
    if (S.extra) {
      const problem = (level, file, line, message, fix) => S.built.problems.push({ level, file, line, message, fix: fix || "" });
      S.built.tracks.push(Beat.parseSong(S.extra, S.over[S.extra], problem));
    }
    if (S.sel >= S.built.tracks.length) S.sel = Math.max(0, S.built.tracks.length - 1);
    const song = current();
    if (song && !song.sections[S.section]) S.section = song.sequence[0] || song.order[0] || null;
    loadSounds();
  }

  // Sound files can only be checked by trying to load them.
  function loadSounds() {
    for (const song of tracks()) {
      for (const s of Object.values(song.sounds)) {
        if (S.sounds[s.src]) continue;
        S.sounds[s.src] = "loading";
        fetch(s.src).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject("missing")))
          .then((data) => Synth.decode(data))
          .then((buf) => { S.buffers[s.src] = buf; S.sounds[s.src] = "ok"; },
                (why) => { S.sounds[s.src] = why === "missing" ? "missing" : "bad"; })
          .finally(showBadge);
      }
    }
  }

  async function soundsReady() {
    for (let i = 0; i < 100 && Object.values(S.sounds).includes("loading"); i++) await new Promise((r) => setTimeout(r, 50));
  }

  function problems() {
    const list = S.built ? S.built.problems.slice() : [];
    for (const song of tracks()) {
      for (const [name, s] of Object.entries(song.sounds)) {
        const state = S.sounds[s.src];
        if (state === "missing") list.push({ level: "error", file: song.file, line: s.line,
          message: `The sound file ${s.src} for ${name} can't be found.`,
          fix: "Check the spelling and the capital letters: on the web, Cowbell.wav and cowbell.wav are different files. Sounds go in the sounds folder (Add file → Upload files)." });
        if (state === "bad") list.push({ level: "error", file: song.file, line: s.line,
          message: `${s.src} isn't a sound file this browser can play.`,
          fix: "Try saving or converting it as .wav or .mp3, then upload it again." });
      }
    }
    if (S.coverBad) list.push({ level: "error", file: "album.txt", line: S.built.album.at.cover || 0,
      message: `The cover picture ${S.built.album.cover} can't be found.`,
      fix: "Check the spelling and capital letters. Pictures go in the images folder (Add file → Upload files)." });
    const order = ["album.txt", "songs/list.txt"].concat(tracks().map((t) => t.file));
    const rank = (p) => (p.level === "error" ? 0 : 1e7) + (order.indexOf(p.file) + 1) * 1e4 + p.line;
    return list.sort((a, b) => rank(a) - rank(b));
  }

  // ---------- the album ----------

  function hash(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

  function coverSvg(album) {
    const [bg, a, b, c] = PALETTES[album.theme] || PALETTES.midnight;
    let h = hash(album.title + "|" + album.by);
    const rnd = () => { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h = (h ^ (h >>> 13)) >>> 0; return (h % 1000) / 1000; };
    let bars = "";
    for (let i = 0; i < 14; i++) {
      const height = 20 + rnd() * 110;
      bars += `<rect x="${14 + i * 12.5}" y="${170 - height}" width="8" height="${height}" rx="4" fill="${i % 3 === 0 ? b : a}" opacity="${0.65 + rnd() * 0.35}"/>`;
    }
    return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="cv" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="${a}" stop-opacity="0.55"/></linearGradient></defs>
      <rect width="200" height="200" fill="${bg}"/><rect width="200" height="200" fill="url(#cv)"/>
      <circle cx="${50 + rnd() * 100}" cy="${40 + rnd() * 30}" r="${18 + rnd() * 14}" fill="${c}" opacity="0.9"/>
      ${bars}<rect x="10" y="176" width="180" height="3" rx="1.5" fill="${c}" opacity="0.6"/></svg>`;
  }

  function renderAlbum() {
    const album = S.built.album;
    document.body.className = "theme-" + album.theme + (S.editing ? " editing" : "");
    $("album-title").textContent = album.title || "Untitled album";
    document.title = album.title || "Beat Lab";
    $("album-by").textContent = album.by ? "by " + album.by : "";
    $("album-about").innerHTML = album.about.map((p) => `<p>${esc(p)}</p>`).join("");
    const cover = $("cover");
    if (album.cover && !S.coverBad) {
      cover.innerHTML = "";
      const img = new Image();
      img.alt = "";
      img.onerror = () => { S.coverBad = true; cover.innerHTML = coverSvg(album); showBadge(); };
      img.src = album.cover;
      cover.appendChild(img);
    } else cover.innerHTML = coverSvg(album);
  }

  function renderTracks() {
    const ol = $("tracks");
    ol.innerHTML = "";
    tracks().forEach((song, i) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "track" + (i === S.sel ? " selected" : "") + (A.session && A.session.track === i ? " playing" : "");
      const changed = S.over[song.name] != null;
      btn.innerHTML = `<span class="num">${i + 1}</span><span class="name">${esc(song.title || song.name)}${song.name === S.extra ? " <em>(draft)</em>" : changed ? " <em>(changed)</em>" : ""}</span>
        <span class="by">${esc(song.by || "")}</span><span class="len">${song.errors ? "⚠ " : ""}${Beat.formatTime(song.duration)}</span>`;
      btn.onclick = () => select(i, !!A.session);
      li.appendChild(btn);
      ol.appendChild(li);
    });
    if (!tracks().length) ol.innerHTML = "<li class='empty'>No songs yet. Open <strong>Problems</strong> below to see why.</li>";
  }

  // ---------- the player deck ----------

  function renderDeck() {
    const song = current();
    $("deck").hidden = !song;
    renderNotice();
    if (!song) return;
    $("song-title").textContent = song.title || song.name;
    $("song-meta").innerHTML = [song.by ? "by " + esc(song.by) : "", `${song.tempo} beats per minute`,
      `${song.steps} steps per section`, song.swing ? `swing ${song.swing}%` : "", Beat.formatTime(song.duration),
      `<code>${esc(song.file)}</code>`].filter(Boolean).join(" · ");
    $("btn-edit").setAttribute("aria-pressed", String(S.editing));
    $("btn-edit").textContent = S.editing ? "✓ Done editing" : "✎ Edit";
    $("edit-tools").hidden = !S.editing;
    if (S.editing) Editor.tools($("edit-tools"), song);
    renderOrder(song);
    renderSections(song);
    renderGrid(song);
    updatePlayButton();
  }

  function renderOrder(song) {
    const chips = $("order-chips");
    chips.innerHTML = "";
    song.sequence.forEach((name, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip" + (name === S.section ? " shown" : "");
      b.dataset.seq = i;
      b.textContent = name;
      b.onclick = () => { S.section = name; renderDeck(); };
      chips.appendChild(b);
    });
    if (!song.sequence.length) chips.innerHTML = "<em>nothing yet: add a play: line</em>";
  }

  function renderSections(song) {
    const box = $("sections");
    box.innerHTML = "";
    const counts = {};
    for (const n of song.sequence) counts[n] = (counts[n] || 0) + 1;
    for (const name of song.order) {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", String(name === S.section));
      b.className = "tab" + (counts[name] ? "" : " unplayed");
      b.innerHTML = esc(name) + `<small>${counts[name] ? "×" + counts[name] : "never played"}</small>`;
      b.onclick = () => {
        S.section = name;
        if (A.session && A.session.loop) A.session.loop = name;
        renderDeck();
      };
      box.appendChild(b);
    }
  }

  function chordLabel(tok) {
    const parts = tok.split("+");
    return parts.length > 1 ? `${esc(parts[0])}<sup>+${parts.length - 1}</sup>` : esc(tok);
  }

  function renderGrid(song) {
    const table = $("grid");
    table.innerHTML = "";
    const sec = song.sections[S.section];
    if (!sec) return;
    const head = document.createElement("tr");
    head.innerHTML = "<th class='label'></th>" + Array.from({ length: song.steps }, (_, i) =>
      `<th class="step${i % 4 === 0 ? " beat" : ""}" data-step="${i}">${i % 4 === 0 ? i / 4 + 1 : ""}</th>`).join("");
    table.appendChild(head);
    sec.rows.forEach((row, r) => {
      const tr = document.createElement("tr");
      tr.className = "row-" + (row.kind || "unknown") + (isMuted(row.inst) ? " muted" : "");
      const label = document.createElement("th");
      label.className = "label";
      label.innerHTML = `<span class="inst">${esc(row.inst)}</span>`;
      if (row.kind) {
        for (const [what, set, title] of [["M", S.muted, "Mute"], ["S", S.solo, "Solo (only this)"]]) {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "ms" + (set.has(row.inst) ? " on" : "");
          b.textContent = what;
          b.title = `${title}: ${row.inst}`;
          b.setAttribute("aria-pressed", String(set.has(row.inst)));
          b.onclick = () => { set.has(row.inst) ? set.delete(row.inst) : set.add(row.inst); renderGrid(current()); };
          label.appendChild(b);
        }
      }
      if (S.editing) {
        const x = document.createElement("button");
        x.type = "button";
        x.className = "ms remove";
        x.textContent = "×";
        x.title = "Remove this row";
        x.onclick = () => Editor.removeRow(r);
        label.appendChild(x);
      }
      tr.appendChild(label);
      for (let i = 0; i < song.steps; i++) {
        const td = document.createElement("td");
        const tok = row.tokens[i] || ".";
        const cell = row.cells[i];
        td.dataset.step = i;
        td.className = "cell" + (i % 4 === 0 ? " beat" : "");
        if (!row.kind) td.className += " broken";
        else if (cell === "hold") td.className += " hold";
        else if (cell && row.kind !== "melodic" && !cell.notes) td.className += cell.vel > 1 ? " hit loud" : " hit";
        else if (cell) { td.className += " note"; td.innerHTML = chordLabel(tok); td.title = tok; }
        else if (tok !== "." && tok !== "-") { td.className += " bad"; td.textContent = "?"; td.title = tok; }
        if (S.editing && row.kind) {
          td.tabIndex = 0;
          td.onclick = (e) => Editor.cellClick(r, i, td, e);
          td.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); Editor.cellClick(r, i, td, e); } };
        }
        tr.appendChild(td);
      }
      table.appendChild(tr);
    });
    if (!sec.rows.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td class="empty-row" colspan="${song.steps + 1}">This section is empty.${S.editing ? " Add a row above." : ""}</td>`;
      table.appendChild(tr);
    }
  }

  function renderNotice() {
    const n = $("notice");
    const song = current();
    if (!song || S.over[song.name] == null) { n.hidden = true; n.className = ""; return; }
    const draft = song.name === S.extra;
    n.className = "changed";
    n.hidden = false;
    n.innerHTML = draft
      ? `<strong>Testing a draft.</strong> It's only in this browser tab, and nobody else hears it.
         <button type="button" data-do="text">Edit as text</button> <button type="button" data-do="drop">Stop testing</button>`
      : `<strong>${esc(song.file)} has changes that are only in this browser.</strong> To keep them, copy the song as text and paste it into the file on GitHub.
         <button type="button" data-do="copy">Copy as text</button> <button type="button" data-do="text">Edit as text</button>
         <button type="button" data-do="undo"${(S.undo[song.name] || []).length ? "" : " disabled"}>Undo</button> <button type="button" data-do="drop">Throw away changes</button>`;
    n.querySelectorAll("button").forEach((b) => { b.onclick = () => noticeAction(b.dataset.do); });
  }

  function noticeAction(what) {
    const song = current();
    if (what === "copy") Editor.copyPanel(song);
    if (what === "text") Draft.open(song.name);
    if (what === "undo") {
      const prev = (S.undo[song.name] || []).pop();
      if (prev != null) { setText(song.name, prev, true); }
    }
    if (what === "drop") dropChanges(song.name);
  }

  function dropChanges(name) {
    delete S.over[name];
    delete S.undo[name];
    if (S.extra === name) { S.extra = null; stop(); }
    refresh();
  }

  // The editor and the draft tester both work by changing a song's text.
  function setText(name, text, isUndo) {
    const before = S.over[name] != null ? S.over[name] : S.live.songs[name];
    if (!isUndo && before != null && before !== text) (S.undo[name] = S.undo[name] || []).push(before);
    if (S.live.songs[name] === text && !(S.undo[name] || []).length) delete S.over[name];
    else S.over[name] = text;
    refresh();
  }

  function addDraft(name, text) {
    S.extra = name;
    S.over[name] = text;
    rebuild();
    S.sel = tracks().length - 1;
    refresh();
  }

  function refresh() {
    rebuild();
    renderAlbum();
    renderTracks();
    renderDeck();
    showBadge();
    if (!A.session) drawScope();
  }

  function select(i, keepPlaying) {
    if (i < 0 || i >= tracks().length) return;
    stop();
    S.sel = i;
    const song = current();
    S.section = song.sequence[0] || song.order[0] || null;
    renderTracks();
    renderDeck();
    if (keepPlaying) play();
  }

  // ---------- sound ----------

  const isMuted = (inst) => (S.solo.size ? !S.solo.has(inst) : S.muted.has(inst));

  function audio() {
    if (!A.ctx) {
      A.ctx = new (window.AudioContext || window.webkitAudioContext)();
      A.main = Synth.chain(A.ctx, A.ctx.destination);
      $("status").textContent = `${A.ctx.sampleRate.toLocaleString()} samples per second`;
    }
    if (A.ctx.state === "suspended") A.ctx.resume();
    return A.ctx;
  }

  // Sounds are scheduled a little ahead on the audio clock, so they land
  // exactly on time even if the page is busy for a moment.
  const LOOKAHEAD = 0.15;

  function play() {
    const song = current();
    if (!song) return;
    if (!S.editing && !song.sequence.length) { flash("This song has nothing to play yet. Open Problems to see why."); return; }
    stop();
    const ctx = audio();
    const gain = ctx.createGain();
    gain.connect(A.main.input);
    A.session = {
      gain, outFor: Synth.outputs(ctx, gain, song), track: S.sel,
      seq: 0, step: 0, next: ctx.currentTime + 0.08, queue: [], endAt: null,
      loop: S.editing ? S.section : null, shown: null,
    };
    A.timer = setInterval(tick, 25);
    tick();
    requestAnimationFrame(frame);
    updatePlayButton();
    renderTracks();
  }

  function tick() {
    const s = A.session, ctx = A.ctx;
    const song = tracks()[s.track];
    if (!song) return stop();
    while (!s.endAt && s.next < ctx.currentTime + LOOKAHEAD) {
      if (s.loop && !song.sections[s.loop]) s.loop = S.section;
      const secName = s.loop || song.sequence[s.seq];
      if (!secName) { s.endAt = s.next + 0.6; break; }
      if (s.step >= song.steps) s.step = 0;
      const stepLen = Beat.stepSeconds(song);
      Synth.playStep(ctx, s.outFor, song, secName, s.step, s.next + Synth.swingDelay(song, s.step), stepLen, S.buffers, isMuted);
      s.queue.push({ t: s.next, sec: secName, seq: s.loop ? -1 : s.seq, step: s.step });
      s.next += stepLen;
      s.step++;
      if (s.step >= song.steps) { s.step = 0; if (!s.loop) s.seq++; }
    }
    if (s.endAt && ctx.currentTime > s.endAt) finished();
  }

  function finished() {
    const next = A.session.track + 1;
    stop();
    if ($("keep-going").checked && !S.editing && next < tracks().length) select(next, true);
  }

  function stop() {
    if (!A.session) return;
    const s = A.session, ctx = A.ctx;
    s.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.015);
    setTimeout(() => s.gain.disconnect(), 300);
    clearInterval(A.timer);
    A.session = null;
    document.querySelectorAll(".now").forEach((e) => e.classList.remove("now"));
    document.querySelectorAll(".chip.playing").forEach((e) => e.classList.remove("playing"));
    updatePlayButton();
    renderTracks();
    drawScope();
  }

  function updatePlayButton() {
    $("btn-play").textContent = A.session ? "■ Stop" : S.editing ? "▶ Loop this section" : "▶ Play";
    $("btn-play").classList.toggle("playing", !!A.session);
  }

  // Lights up the step you're hearing right now.
  function frame() {
    const s = A.session;
    if (!s) return;
    let cur = null;
    while (s.queue.length && s.queue[0].t <= A.ctx.currentTime) cur = s.queue.shift();
    if (cur && s.track === S.sel) {
      if (!S.editing && cur.sec !== S.section) { S.section = cur.sec; renderDeck(); }
      document.querySelectorAll(".now").forEach((e) => e.classList.remove("now"));
      if (cur.sec === S.section) document.querySelectorAll(`#grid [data-step="${cur.step}"]`).forEach((e) => e.classList.add("now"));
      if (cur.seq !== s.shown) {
        s.shown = cur.seq;
        document.querySelectorAll(".chip.playing").forEach((e) => e.classList.remove("playing"));
        const chip = document.querySelector(`.chip[data-seq="${cur.seq}"]`);
        if (chip) chip.classList.add("playing");
      }
    }
    drawScope();
    requestAnimationFrame(frame);
  }

  let wave = null;
  function drawScope() {
    const c = $("scope"), g = c.getContext("2d");
    const w = (c.width = Math.round(c.clientWidth * (window.devicePixelRatio || 1)) || 640);
    const h = (c.height = Math.round(90 * (window.devicePixelRatio || 1)));
    const style = getComputedStyle(document.body);
    g.clearRect(0, 0, w, h);
    g.strokeStyle = style.getPropertyValue("--line").trim() || "#888";
    g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
    g.strokeStyle = style.getPropertyValue("--accent2").trim() || "#5ad1ff";
    g.lineWidth = 2 * (window.devicePixelRatio || 1);
    g.beginPath();
    if (A.session && A.main) {
      const an = A.main.analyser;
      if (!wave || wave.length !== an.fftSize) wave = new Float32Array(an.fftSize);
      an.getFloatTimeDomainData(wave);
      const shown = 600;
      for (let i = 0; i < shown; i++) {
        const x = (i / (shown - 1)) * w, y = h / 2 - wave[i] * h * 0.45;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
    } else { g.moveTo(0, h / 2); g.lineTo(w, h / 2); }
    g.stroke();
  }

  function preview(inst, midi) {
    const ctx = audio();
    Synth.preview(ctx, A.main.input, inst, midi, S.buffers, current());
  }

  // ---------- download as WAV ----------

  async function downloadWav() {
    const song = current();
    if (!song || !song.sequence.length) { flash("This song has nothing to play yet."); return; }
    const btn = $("btn-wav");
    btn.disabled = true;
    btn.textContent = "Making the WAV file…";
    try {
      await soundsReady();
      const audioData = await Synth.render(song, S.buffers);
      const blob = Synth.wav(audioData);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = (song.title || song.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".wav";
      App.lastWav = { name: a.download, size: blob.size, seconds: audioData.duration, blob };
      document.body.appendChild(a);
      a.click();
      a.remove();
      flash(`Saved ${a.download}: ${(blob.size / 1e6).toFixed(1)} MB for ${Beat.formatTime(audioData.duration)} of sound (${audioData.length.toLocaleString()} samples per speaker).`);
    } catch (e) {
      flash("Couldn't make the WAV file: " + e.message);
    }
    btn.disabled = false;
    btn.textContent = "Download as WAV";
  }

  function flash(text) { $("status").textContent = text; }

  // ---------- problems and panels ----------

  function showBadge() {
    const all = problems();
    const errors = all.filter((p) => p.level === "error").length;
    const btn = $("btn-problems");
    btn.className = errors ? "bad" : all.length ? "warn" : "good";
    btn.textContent = all.length ? `⚠ ${all.length} problem${all.length === 1 ? "" : "s"}` : "✓ No problems";
  }

  function problemList(list) {
    const wrap = document.createElement("div");
    if (!list.length) {
      wrap.innerHTML = "<p class='all-good'>✓ No problems. Every song is on the track list, every row has the right number of steps, and every section in play: exists.</p>";
      return wrap;
    }
    const intro = document.createElement("p");
    intro.textContent = "Red problems stop part of a song from playing. Yellow ones are probably mistakes. Fix the first one and check again: later problems are sometimes caused by earlier ones.";
    wrap.appendChild(intro);
    for (const p of list) {
      const card = document.createElement("div");
      card.className = "problem " + p.level;
      card.innerHTML = `<div class="where">${esc(p.file)}${p.line ? ", line " + p.line : ""}</div>
        <div class="what">${esc(p.message)}</div>${p.fix ? `<div class="fix">${esc(p.fix)}</div>` : ""}`;
      wrap.appendChild(card);
    }
    return wrap;
  }

  function openPanel(title, body) {
    $("panel-title").textContent = title;
    const b = $("panel-body");
    b.innerHTML = "";
    b.appendChild(body);
    $("panel").hidden = false;
    $("panel-close").focus();
  }

  function closePanel() { $("panel").hidden = true; }

  function toggleEdit() {
    stop();
    S.editing = !S.editing;
    Editor.closePicker();
    document.body.classList.toggle("editing", S.editing);
    renderDeck();
  }

  // ---------- start ----------

  function bind() {
    $("btn-play").onclick = () => (A.session ? stop() : play());
    $("btn-edit").onclick = toggleEdit;
    $("btn-draft").onclick = () => Draft.open();
    $("btn-wav").onclick = downloadWav;
    $("btn-record").onclick = () => Recorder.open();
    $("btn-problems").onclick = () => openPanel("Problems", problemList(problems()));
    $("panel-close").onclick = closePanel;
    $("panel").onclick = (e) => { if (e.target.id === "panel") closePanel(); };
    addEventListener("keydown", (e) => {
      if (e.key === "Escape") { Editor.closePicker(); return closePanel(); }
      if (e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (!$("panel").hidden) return;
      if (e.key === " " && !/BUTTON|TD/.test(e.target.tagName)) { e.preventDefault(); A.session ? stop() : play(); }
      if (e.key === "e" || e.key === "E") toggleEdit();
      if (e.key === "ArrowRight") select(S.sel + 1, !!A.session);
      if (e.key === "ArrowLeft") select(S.sel - 1, !!A.session);
    });
    addEventListener("beforeunload", (e) => {
      if (Object.keys(S.over).some((n) => n !== S.extra)) { e.preventDefault(); e.returnValue = ""; }
    });
    addEventListener("resize", () => { if (!A.session) drawScope(); });
  }

  async function start() {
    bind();
    if (location.protocol === "file:") {
      $("album-title").textContent = "Open this from your live link";
      $("album-about").innerHTML = "<p>This project reads its song files from a web server, so double-clicking <code>index.html</code> won't work. Use your live link: <code>https://YOUR-USERNAME.github.io/beat-lab/</code></p>";
      $("deck").hidden = true;
      return;
    }
    S.live = await load();
    rebuild();
    const t = Number(new URLSearchParams(location.search).get("track"));
    if (t >= 1 && t <= tracks().length) S.sel = t - 1;
    const song = current();
    S.section = song ? song.sequence[0] || song.order[0] : null;
    refresh();
    drawScope();
    App.ready = true;
  }

  return {
    start, state: S, audioState: A, current, tracks, setText, addDraft, dropChanges, preview,
    openPanel, closePanel, problemList, problems, play, stop, select, refresh, renderDeck, flash, downloadWav,
    ready: false, lastWav: null,
  };
})();

window.addEventListener("load", App.start);
