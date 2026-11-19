/* Engine: Edit mode. Click squares to change a section, then "Copy as text"
   to get the song file back, ready to paste into GitHub. The text file is
   always the real song: every click rewrites one line of it.
   You don't need to edit this file. */

const Editor = (() => {
  const KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const HOME_OCTAVE = { bass: 2, pad: 3, lead: 4, pluck: 4 };
  let picker = null; // { el, r, step, octave }

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function rowAt(r) {
    const song = App.current();
    return song && song.sections[App.state.section] ? song.sections[App.state.section].rows[r] : null;
  }

  // The row's steps, exactly as many as the song has.
  function tokensOf(song, row) {
    const t = row.tokens.slice(0, song.steps);
    while (t.length < song.steps) t.push(".");
    return t;
  }

  function cellEl(r, step) {
    return document.querySelector(`#grid tr:nth-child(${r + 2}) td[data-step="${step}"]`);
  }

  function change(r, step, tok) {
    const song = App.current(), row = rowAt(r);
    if (!row) return;
    const toks = tokensOf(song, row);
    if (toks[step] === tok) return;
    toks[step] = tok;
    App.setText(song.name, Beat.setRow(song, App.state.section, r, toks));
    const td = cellEl(r, step);
    if (picker && td) place(td);
    else if (td) td.focus();
  }

  function cellClick(r, step, td) {
    const song = App.current(), row = rowAt(r);
    if (!row) return;
    if (row.kind === "melodic") { openPicker(r, step, td); return; }
    closePicker();
    const tok = tokensOf(song, row)[step];
    const next = tok === "." ? "x" : tok === "x" ? "X" : ".";
    if (next !== ".") App.preview(row.inst, null);
    change(r, step, next);
  }

  // ---------- the note picker ----------

  function octaveFor(song, row, step) {
    const toks = tokensOf(song, row);
    for (let i = step; i >= 0; i--) {
      const n = Beat.parseNote(toks[i].split("+")[0]);
      if (n.midi !== undefined) return Math.floor(n.midi / 12) - 1;
    }
    return HOME_OCTAVE[row.inst] ?? 4;
  }

  function openPicker(r, step, td) {
    closePicker();
    const song = App.current(), row = rowAt(r);
    picker = { r, step, octave: octaveFor(song, row, step), el: document.createElement("div") };
    picker.el.className = "picker";
    picker.el.setAttribute("role", "dialog");
    picker.el.setAttribute("aria-label", "Choose a note");
    document.body.appendChild(picker.el);
    drawPicker();
    place(td);
    const first = picker.el.querySelector(".key");
    if (first) first.focus();
  }

  function drawPicker() {
    const song = App.current(), row = rowAt(picker.r);
    if (!row) return closePicker();
    const tok = tokensOf(song, row)[picker.step];
    picker.el.innerHTML = `
      <div class="picker-head"><span><strong>${esc(row.inst)}</strong>, step ${picker.step + 1}</span><button type="button" class="x" aria-label="Close">×</button></div>
      <div class="octave"><button type="button" data-oct="-1" aria-label="Lower octave">◀</button>
        <span>Octave <strong>${picker.octave}</strong></span>
        <button type="button" data-oct="1" aria-label="Higher octave">▶</button></div>
      <div class="keys">${KEYS.map((k) => `<button type="button" class="key${k.includes("#") ? " black" : ""}${tok === k + picker.octave ? " on" : ""}" data-note="${k}${picker.octave}">${k}</button>`).join("")}</div>
      <div class="picker-row"><input type="text" value="${esc(tok)}" aria-label="Note or chord" spellcheck="false"><button type="button" class="use">Use</button></div>
      <div class="picker-row"><button type="button" data-tok=".">Rest ( . )</button><button type="button" data-tok="-">Hold ( - )</button></div>
      <p class="hint">Hold keeps the note before it sounding. Type a chord like C4+E4+G4 to play notes together.</p>`;
    const el = picker.el;
    el.querySelector(".x").onclick = closePicker;
    el.querySelectorAll("[data-oct]").forEach((b) => {
      b.onclick = () => { picker.octave = Math.max(0, Math.min(8, picker.octave + Number(b.dataset.oct))); drawPicker(); };
    });
    el.querySelectorAll(".key").forEach((b) => {
      b.onclick = () => {
        App.preview(row.inst, Beat.parseNote(b.dataset.note).midi);
        change(picker.r, picker.step, b.dataset.note);
        drawPicker();
        const again = picker && picker.el.querySelector(`[data-note="${b.dataset.note}"]`);
        if (again) again.focus();
      };
    });
    el.querySelectorAll("[data-tok]").forEach((b) => { b.onclick = () => { change(picker.r, picker.step, b.dataset.tok); drawPicker(); }; });
    const input = el.querySelector("input");
    const use = () => {
      const v = input.value.trim().replace(/\s+/g, "");
      if (!v) return;
      const first = Beat.parseNote(v.split("+")[0]);
      if (first.midi !== undefined) App.preview(row.inst, first.midi);
      change(picker.r, picker.step, v);
      drawPicker();
    };
    el.querySelector(".use").onclick = use;
    input.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); use(); } };
  }

  function place(td) {
    if (!picker) return;
    const r = td.getBoundingClientRect();
    const w = Math.min(300, window.innerWidth - 16);
    picker.el.style.width = w + "px";
    picker.el.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + window.scrollX + "px";
    picker.el.style.top = r.bottom + 6 + window.scrollY + "px";
  }

  function closePicker() {
    if (picker) { picker.el.remove(); picker = null; }
  }

  // ---------- the tools above the grid ----------

  function tools(box, song) {
    const sec = song.sections[App.state.section];
    const used = new Set(sec ? sec.rows.map((r) => r.inst) : []);
    const all = Beat.DRUMS.concat(Beat.MELODIC, Object.keys(song.sounds));
    const options = all.filter((i) => !used.has(i)).concat(all.filter((i) => used.has(i)));
    box.innerHTML = `
      <div class="tools-row">
        <label>Tempo <input id="ed-tempo" type="number" min="40" max="220" step="1" value="${song.tempo}"> beats per minute</label>
        ${sec ? `<label>Add <select id="ed-add">${options.map((i) => `<option>${esc(i)}</option>`).join("")}</select> to <strong>${esc(sec.name)}</strong></label>
        <button type="button" id="ed-add-go">Add row</button>` : ""}
        <button type="button" id="ed-copy" class="primary">Copy as text</button>
      </div>
      <p class="tip">Click a drum square to switch it: hit → loud hit → rest. Click a melody square to pick a note.
        Play loops this section while you edit. Changes stay in this browser until you <strong>Copy as text</strong> and paste it into the song file on GitHub.</p>`;
    const tempo = box.querySelector("#ed-tempo");
    tempo.onchange = () => {
      const v = Math.round(Number(tempo.value));
      if (!(v >= 40 && v <= 220)) { App.flash("Tempo has to be from 40 to 220."); tempo.value = song.tempo; return; }
      App.setText(song.name, Beat.setSetting(App.current(), "tempo", String(v)));
    };
    if (sec) {
      box.querySelector("#ed-add-go").onclick = () => {
        const inst = box.querySelector("#ed-add").value;
        App.setText(song.name, Beat.addRow(App.current(), App.state.section, inst));
      };
    }
    box.querySelector("#ed-copy").onclick = () => copyPanel(App.current());
  }

  function removeRow(r) {
    closePicker();
    const song = App.current();
    App.setText(song.name, Beat.removeRow(song, App.state.section, r));
  }

  // ---------- copy as text ----------

  function copyPanel(song) {
    const body = document.createElement("div");
    body.className = "draft-form";
    body.innerHTML = `
      <p>This is your whole song file, with your changes in it.</p>
      <ol>
        <li>Click <strong>Copy</strong>.</li>
        <li>On GitHub, open <code>${esc(song.file)}</code> and click the pencil (<em>Edit this file</em>).</li>
        <li>Select everything (<kbd>Ctrl</kbd>+<kbd>A</kbd>, or <kbd>⌘</kbd>+<kbd>A</kbd> on a Mac) and paste (<kbd>Ctrl</kbd>+<kbd>V</kbd>).</li>
        <li><strong>Commit changes...</strong> → <strong>Create a new branch for this commit and start a pull request</strong>.</li>
      </ol>
      <textarea id="copy-text" readonly spellcheck="false"></textarea>
      <div class="draft-buttons"><button type="button" id="copy-go">Copy</button></div>
      <p id="copy-done" class="all-good" hidden>Copied! Now paste it into GitHub.</p>`;
    const area = body.querySelector("#copy-text");
    area.value = song.text;
    body.querySelector("#copy-go").onclick = async () => {
      let ok = false;
      try { await navigator.clipboard.writeText(area.value); ok = true; } catch (e) {
        area.select();
        try { ok = document.execCommand("copy"); } catch (e2) { ok = false; }
      }
      const done = body.querySelector("#copy-done");
      done.hidden = false;
      done.textContent = ok ? "Copied! Now paste it into GitHub." : "Your browser blocked copying. Click in the box, select everything and copy it yourself.";
    };
    App.openPanel("Copy as text", body);
  }

  return { cellClick, tools, removeRow, copyPanel, closePicker, tokensOf };
})();
