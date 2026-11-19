/* Engine: reads album.txt, songs/list.txt and the song files, and checks them
   for problems. The web page uses this file, and so does the automatic Beat
   check that runs on GitHub whenever someone opens a pull request.
   You don't need to edit this file. */

const Beat = (() => {
  // The built-in instruments. Drums play x (hit), X (loud hit) and . (rest).
  // Melody instruments play notes like C4, F#3 or Bb2, and - holds a note longer.
  const DRUMS = ["kick", "snare", "hat", "clap", "tom"];
  const MELODIC = ["bass", "lead", "pad", "pluck"];
  const THEMES = ["midnight", "sunset", "lagoon", "daylight"];
  const SONG_KEYS = ["by", "tempo", "steps", "swing", "sound", "volume"];
  const ALBUM_KEYS = ["title", "by", "theme", "about", "cover"];
  const SOUND_TYPES = ["wav", "mp3", "ogg", "m4a", "webm", "aac"];
  const NAME = /^[a-z][a-z0-9-]*$/;
  const LETTERS = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const MAX_MINUTES = 6;

  const plural = (n, word) => n + " " + word + (n === 1 ? "" : "s");

  // Comments (<!-- like this -->) are notes for writers. Blank them out but
  // keep their line breaks, so line numbers in messages still match the file.
  function stripComments(text) {
    return text.replace(/<!--[\s\S]*?(-->|$)/g, (m) => m.replace(/[^\n]/g, ""));
  }

  function distance(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++)
      for (let j = 1; j <= b.length; j++)
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }

  function closest(name, names) {
    let best = null, bestD = Infinity;
    for (const n of names) {
      const dd = distance(name.toLowerCase(), n.toLowerCase());
      if (dd < bestD) { best = n; bestD = dd; }
    }
    return bestD <= (name.length <= 4 ? 1 : Math.max(2, Math.floor(name.length / 4))) ? best : null;
  }

  // ---------- notes ----------

  // A note name like C4, F#3 or Bb2 → its number on a piano keyboard (MIDI
  // numbering: middle C, C4, is 60). Returns { midi } or { error, fix }.
  function parseNote(tok) {
    const m = /^([A-Za-z])([#♯b♭]?)(-?\d+)?$/.exec(tok);
    if (!m) return { error: `"${tok}" isn't a note.`, fix: "Notes look like C4, F#3 or Bb2: a letter from A to G, then # (sharp) or b (flat) if you want one, then an octave number." };
    const letter = m[1].toLowerCase();
    const acc = m[2] === "#" || m[2] === "♯" ? "#" : m[2] ? "b" : "";
    const up = m[1].toUpperCase();
    if (!(letter in LETTERS)) {
      return { error: `"${tok}" isn't a note: note names only go from A to G.`,
        fix: letter === "h" ? `Did you mean B${m[3] ?? 4}? (In some countries B is called H.)` : "Notes look like C4, F#3 or Bb2." };
    }
    if (m[3] === undefined) {
      return { error: `"${tok}" needs an octave number.`,
        fix: `Add a number for how high it is: ${up}${acc}4 is in the middle of a piano, ${up}${acc}3 is lower and ${up}${acc}5 is higher.` };
    }
    const oct = Number(m[3]);
    if (oct < 0 || oct > 8) {
      return { error: `"${tok}" is off the end of the piano: octaves go from 0 to 8.`,
        fix: `Try ${up}${acc}${oct > 8 ? 6 : 2}. For reference, C4 is middle C.` };
    }
    return { midi: 12 * (oct + 1) + LETTERS[letter] + (acc === "#" ? 1 : acc === "b" ? -1 : 0) };
  }

  const noteName = (midi) => NOTE_NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);

  function kindOf(inst, song) {
    if (DRUMS.includes(inst)) return "drum";
    if (MELODIC.includes(inst)) return "melodic";
    if (song && song.sounds[inst]) return "sample";
    return null;
  }

  // "x . . . | x . . ." → ["x", ".", ".", ".", "x", ".", ".", "."]. Beat lines (|)
  // are just for reading. Squashed-up steps like x... are split apart too.
  function tokenize(value, kind) {
    const toks = value.replace(/\|/g, " ").trim().split(/\s+/).filter(Boolean);
    const out = [];
    const squashed = kind === "melodic" ? /^[.\-]+$/ : /^[xX.\-]+$/;
    for (const t of toks) {
      if (t.length > 1 && squashed.test(t)) out.push(...t.split(""));
      else out.push(t);
    }
    return out;
  }

  // Turns a row's steps into what to play. Each cell is null (silence), "hold"
  // (the note before keeps sounding), or { vel, notes, len }.
  function cellsFor(kind, toks, inst, report) {
    const cells = [];
    let last = -1;
    toks.forEach((t) => {
      if (t === ".") { cells.push(null); last = -1; return; }
      if (t === "-") {
        if (kind !== "melodic") {
          report(`${inst} can't hold a note: - (hold) only works for ${MELODIC.join(", ")}.`, "Use . for a rest instead.");
          cells.push(null); return;
        }
        if (last < 0) {
          report(`A - in the ${inst} row holds the note before it, but there's no note right before it.`,
            "Put a note (like C4) before the -, or change the - to . for a rest.");
          cells.push(null); return;
        }
        cells[last].len++;
        cells.push("hold");
        return;
      }
      if (t === "x" || t === "X") {
        if (kind === "melodic") {
          report(`${inst} plays notes, so it needs a note like C4 instead of ${t}.`,
            "Melody instruments (bass, lead, pad, pluck) use note names like C4, F#3 or Bb2. Use . for a rest and - to hold a note longer.");
          cells.push(null); return;
        }
        cells.push({ vel: t === "X" ? 1.35 : 1, notes: null, len: 1 });
        last = -1;
        return;
      }
      if (kind === "drum") {
        const looksLikeNote = t.split("+").every((p) => parseNote(p).midi !== undefined);
        report(looksLikeNote ? `${inst} is a drum, so it can't play notes like ${t}.` : `"${t}" isn't something ${inst} can play.`,
          "Drums use x for a hit, X for a loud hit and . for a rest.");
        cells.push(null); return;
      }
      const notes = [];
      for (const part of t.split("+")) {
        const n = parseNote(part);
        if (n.error) { report(n.error, n.fix); cells.push(null); return; }
        notes.push(n.midi);
      }
      cells.push({ vel: 1, notes, len: 1 });
      last = kind === "melodic" ? cells.length - 1 : -1;
    });
    return cells;
  }

  // ---------- songs ----------

  function parseSong(name, text, problem) {
    const file = "songs/" + name;
    const raw = String(text || "").replace(/\r\n?/g, "\n");
    const song = {
      name, file, text: raw, title: "", by: "", tempo: 120, steps: 16, swing: 0,
      sounds: {}, volumes: {}, sections: {}, order: [], play: [], sequence: [],
      duration: 0, at: {}, errors: 0,
    };
    const err = (line, message, fix) => { song.errors++; problem("error", file, line, message, fix); };
    const warn = (line, message, fix) => problem("warning", file, line, message, fix);
    const volumeLines = [];
    let section = null;

    const open = raw.lastIndexOf("<!--");
    if (open >= 0 && raw.indexOf("-->", open) < 0) {
      err(raw.slice(0, open).split("\n").length, "This note starts with <!-- but never ends, so everything after it is hidden.", "Add --> where the note ends.");
    }

    stripComments(raw).split("\n").forEach((rawLine, i) => {
      const line = i + 1;
      const s = rawLine.trim();
      if (!s) return;
      let m;

      if (s.startsWith("###")) {
        err(line, "Sections start with exactly two # signs.", "Change it to ## and a name, like ## chorus.");
        return;
      }
      if ((m = /^##(.*)$/.exec(s))) {
        let sec = m[1].trim().toLowerCase();
        if (!sec) { err(line, "This section has no name.", "Put a name after the ##, like ## verse."); sec = "section-" + line; }
        else if (/\s/.test(sec)) {
          const dashed = sec.replace(/\s+/g, "-");
          err(line, `Section names can't have spaces: "${sec}".`, `Use dashes instead: ## ${dashed} (and write ${dashed} in your play: line).`);
          sec = dashed;
        } else if (!NAME.test(sec)) {
          err(line, `"${sec}" isn't a good section name.`, "Section names use lowercase letters, numbers and dashes, and start with a letter, like verse-2.");
        }
        if (song.sections[sec]) {
          err(line, `There are two sections called ${sec} (lines ${song.sections[sec].line} and ${line}).`, "Rename one of them, like " + sec + "-2.");
          sec = sec + "-" + line;
        }
        section = { name: sec, line, rows: [] };
        song.sections[sec] = section;
        song.order.push(sec);
        return;
      }
      if ((m = /^#(?!#)\s*(.*)$/.exec(s))) {
        if (song.at.title) warn(line, "This song has two title lines.", `The first one (line ${song.at.title}) is used. Delete one of them.`);
        else { song.title = m[1].trim(); song.at.title = line; }
        return;
      }
      if (!(m = /^([^:]+):(.*)$/.exec(s))) {
        err(line, "I don't understand this line.",
          section ? "Each line in a section is an instrument and its steps, like  kick: x . . . x . . .  (and the play: line goes at the bottom)."
                  : "Above the first section, use settings like tempo: 96. Sections start with a line like ## intro.");
        return;
      }
      const key = m[1].trim().toLowerCase();
      const value = m[2].trim();

      if (key === "play") {
        if (song.at.play) { err(line, `This song has two play: lines (lines ${song.at.play} and ${line}).`, "Combine them into one line, with commas between the sections."); return; }
        song.at.play = line;
        for (const item of value.split(",").map((t) => t.trim()).filter(Boolean)) {
          const pm = /^(.+?)(?:\s+[x×*]\s*(\d+)|\s*[×*]\s*(\d+))?$/i.exec(item);
          const times = Number(pm[2] || pm[3] || 1);
          if (times < 1 || times > 64) err(line, `"${item}" repeats ${times} times.`, "Use a number from 1 to 64, like verse x2.");
          song.play.push({ name: pm[1].trim().toLowerCase(), times: Math.max(1, Math.min(64, times)), line });
        }
        if (!song.play.length) err(line, "The play: line is empty.", "List the sections in the order they play, like play: intro, verse x2, chorus.");
        return;
      }

      if (section && !SONG_KEYS.includes(key)) {
        section.rows.push({ inst: key, line, value });
        return;
      }
      if (section) {
        err(line, `${key}: is a setting, so it goes at the top of the file, above the first section.`,
          `Move this line up, under the title.`);
        return;
      }
      if (!SONG_KEYS.includes(key)) {
        if (DRUMS.includes(key) || MELODIC.includes(key)) {
          err(line, `This ${key} row isn't in a section.`, "Put a section line, like ## intro, above it.");
        } else {
          const near = closest(key, SONG_KEYS);
          err(line, `"${key}" isn't a song setting.`, near ? `Did you mean ${near}:?` : `Settings are: ${SONG_KEYS.join(", ")}.`);
        }
        return;
      }
      if (song.at[key] && key !== "sound" && key !== "volume") {
        warn(line, `${key}: is set twice (lines ${song.at[key]} and ${line}).`, "The second one wins. Delete the one you don't want.");
      }
      if (key !== "sound" && key !== "volume") song.at[key] = line;

      if (key === "by") song.by = value;
      else if (key === "tempo") {
        const n = Number(value);
        if (!/^\d+(\.\d+)?$/.test(value)) err(line, `The tempo needs to be a number, not "${value}".`, "Tempo is beats per minute: 70 is relaxed, 120 is upbeat, 160 is fast. Write it like tempo: 96.");
        else if (n < 40 || n > 220) err(line, `A tempo of ${value} is ${n < 40 ? "too slow" : "too fast"}.`, "Use a tempo from 40 to 220 beats per minute.");
        else song.tempo = n;
      } else if (key === "steps") {
        const n = Number(value);
        if (!/^\d+$/.test(value)) err(line, `steps: needs a whole number, not "${value}".`, "Most songs use steps: 16 (one bar of 4 beats, 4 steps per beat).");
        else if (n < 2 || n > 64) err(line, `steps: ${value} is out of range.`, "Use a number from 2 to 64. Most songs use 16.");
        else song.steps = n;
      } else if (key === "swing") {
        const sm = /^(\d+)\s*%?$/.exec(value);
        if (!sm || Number(sm[1]) > 50) err(line, `swing: needs a percent from 0 to 50, not "${value}".`, "Try swing: 25% for a bouncy feel. 0% is straight.");
        else song.swing = Number(sm[1]);
      } else if (key === "sound") {
        const sm = /^([^=]+)=\s*(\S+)\s*$/.exec(value);
        if (!sm) { err(line, "This sound: line doesn't say which file to use.", "Write it like  sound: cowbell = sounds/cowbell.wav"); return; }
        const sname = sm[1].trim().toLowerCase(), src = sm[2].replace(/^\.?\//, "");
        if (DRUMS.includes(sname) || MELODIC.includes(sname)) { err(line, `${sname} is already a built-in instrument.`, `Give your sound its own name, like my-${sname}.`); return; }
        if (!NAME.test(sname)) { err(line, `"${sname}" isn't a good sound name.`, "Use lowercase letters, numbers and dashes, like cowbell or dog-bark."); return; }
        if (song.sounds[sname]) { err(line, `There are two sounds called ${sname}.`, "Give each sound its own name."); return; }
        const ext = (src.split(".").pop() || "").toLowerCase();
        if (!src.includes(".") || !SOUND_TYPES.includes(ext)) {
          err(line, `${src} doesn't look like a sound file.`, `Sound files end in .${SOUND_TYPES.join(", .")}. Upload yours to the sounds folder first.`);
        }
        song.sounds[sname] = { src, line };
      } else if (key === "volume") {
        volumeLines.push({ value, line });
      }
    });

    // Now that every sound: line is known, check the rows.
    const known = DRUMS.concat(MELODIC, Object.keys(song.sounds));
    for (const name of song.order) {
      const sec = song.sections[name];
      if (!sec.rows.length) warn(sec.line, `The section ${name} has no instruments in it, so it's silent.`, "Add rows like  kick: x . . . x . . .  under it, or delete it.");
      for (const row of sec.rows) {
        row.kind = kindOf(row.inst, song);
        if (!row.kind) {
          const near = closest(row.inst, known);
          err(row.line, `There's no instrument called ${row.inst}.`,
            near ? `Did you mean ${near}?` : `Instruments are: ${DRUMS.concat(MELODIC).join(", ")}. To use your own sound, add a line like  sound: ${row.inst} = sounds/${row.inst}.wav  at the top.`);
          row.tokens = []; row.cells = [];
          continue;
        }
        row.tokens = tokenize(row.value, row.kind);
        row.cells = cellsFor(row.kind, row.tokens, row.inst, (message, fix) => err(row.line, message, fix));
        const n = row.tokens.length;
        if (!n) err(row.line, `The ${row.inst} row is empty.`, `Write ${song.steps} steps after it, like  ${row.inst}: ${row.kind === "melodic" ? "C3 . . ." : "x . . ."}`);
        else if (n !== song.steps) {
          const d = Math.abs(n - song.steps);
          err(row.line, `${row.inst} has ${plural(n, "step")}, but this song has steps: ${song.steps}.`,
            n < song.steps ? `Add ${d} more (use . for a rest). Putting | between beats makes steps easier to count.`
                           : `Remove ${d}. Putting | between beats makes steps easier to count.`);
        }
        while (row.cells.length < song.steps) row.cells.push(null);
        row.cells.length = song.steps;
        for (const c of row.cells) if (c && c !== "hold") c.len = Math.min(c.len, song.steps);
      }
    }

    for (const v of volumeLines) {
      const vm = /^(\S+)\s+(\d+)\s*%?$/.exec(v.value);
      if (!vm) { err(v.line, "This volume: line needs an instrument and a percent.", "Write it like  volume: hat 60%"); continue; }
      const inst = vm[1].toLowerCase(), pct = Number(vm[2]);
      if (!known.includes(inst)) {
        const near = closest(inst, known);
        err(v.line, `There's no instrument called ${inst}.`, near ? `Did you mean ${near}?` : `Instruments are: ${known.join(", ")}.`);
      } else if (pct > 200) err(v.line, `${pct}% is too loud.`, "Use a percent from 0 to 200. 100% is normal.");
      else song.volumes[inst] = pct / 100;
    }

    if (!song.at.title) { song.title = name.replace(/\.txt$/i, ""); warn(1, "This song has no title.", "Add a title line at the top, like # Night Drive"); }
    if (!song.order.length) err(1, "This song has no sections, so there's nothing to play.", "Add a section: a line like ## intro, then rows like  kick: x . . . x . . .");
    if (!song.at.play) {
      if (song.order.length) err(song.sections[song.order[song.order.length - 1]].line, "This song has no play: line, so nothing plays.",
        `Add a line at the bottom that lists the sections in order, like play: ${song.order.slice(0, 3).join(", ")}`);
    } else {
      for (const p of song.play) {
        if (song.sections[p.name]) continue;
        const near = closest(p.name, song.order);
        err(p.line, `play: lists ${p.name}, but there's no section called ${p.name}.`,
          near ? `Did you mean ${near}?` : `Sections in this song: ${song.order.join(", ") || "none yet"}. Every name in play: needs a ## section with that name.`);
      }
      const played = new Set(song.play.map((p) => p.name));
      for (const name of song.order) {
        if (!played.has(name)) warn(song.sections[name].line, `The section ${name} is never played.`, `Add ${name} to the play: line, or delete the section.`);
      }
    }
    for (const p of song.play) if (song.sections[p.name]) for (let k = 0; k < p.times; k++) song.sequence.push(p.name);
    song.duration = song.sequence.length * song.steps * stepSeconds(song);
    if (song.duration > MAX_MINUTES * 60) {
      warn(song.at.play || 1, `This song is ${formatTime(song.duration)} long.`, `Songs over ${MAX_MINUTES} minutes are hard to listen to (and slow to download). Repeat sections fewer times, or raise the tempo.`);
    }
    return song;
  }

  // One step is a quarter of a beat (a sixteenth note).
  const stepSeconds = (song) => 60 / song.tempo / 4;
  const formatTime = (sec) => { const t = Math.round(sec); return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0"); };

  // ---------- album.txt and songs/list.txt ----------

  function parseAlbum(text, problem) {
    const album = { title: "", by: "", theme: "midnight", about: [], cover: "", at: {} };
    if (text == null) {
      problem("warning", "album.txt", 0, "There's no album.txt, so the album has no title.", "Create album.txt with lines like  title: Our Album  and  by: Our Team.");
      return album;
    }
    stripComments(String(text).replace(/\r\n?/g, "\n")).split("\n").forEach((rawLine, i) => {
      const line = i + 1;
      const s = rawLine.trim();
      if (!s) return;
      const m = /^([^:]+):(.*)$/.exec(s);
      if (!m) { problem("error", "album.txt", line, "I don't understand this line.", "Every line in album.txt is a setting, like  title: Night Songs. For more notes, add another about: line."); return; }
      const key = m[1].trim().toLowerCase(), value = m[2].trim();
      if (!ALBUM_KEYS.includes(key)) {
        const near = closest(key, ALBUM_KEYS);
        problem("error", "album.txt", line, `"${key}" isn't an album setting.`, near ? `Did you mean ${near}:?` : `Settings are: ${ALBUM_KEYS.join(", ")}.`);
        return;
      }
      album.at[key] = line;
      if (key === "about") { if (value) album.about.push(value); }
      else if (key === "theme") {
        const t = value.toLowerCase();
        if (THEMES.includes(t)) album.theme = t;
        else {
          const near = closest(t, THEMES);
          problem("warning", "album.txt", line, `There's no theme called "${value}".`, (near ? `Did you mean ${near}? ` : "") + `Themes: ${THEMES.join(", ")}.`);
        }
      } else if (key === "cover") album.cover = value.replace(/^\.?\//, "");
      else album[key] = value;
    });
    return album;
  }

  function parseList(text, problem) {
    const list = [];
    if (text == null) {
      problem("error", "songs/list.txt", 0, "There's no songs/list.txt, so the album has no tracks.", "Create songs/list.txt with one song file name per line, like first-light.txt.");
      return list;
    }
    const seen = {};
    stripComments(String(text).replace(/\r\n?/g, "\n")).split("\n").forEach((rawLine, i) => {
      const line = i + 1;
      let s = rawLine.trim().replace(/^(?:[-*+]|\d+[.)])\s+/, "").replace(/^\.?\/?songs\//i, "");
      if (!s) return;
      if (/\s/.test(s)) {
        problem("error", "songs/list.txt", line, `"${s}" has a space in it.`, "Song file names use dashes instead of spaces, like night-drive.txt. Rename the file to match.");
        return;
      }
      if (!/\.txt$/i.test(s)) {
        problem("error", "songs/list.txt", line, `"${s}" is missing .txt at the end.`, `Did you mean ${s}.txt? Write the whole file name.`);
        s += ".txt";
      }
      if (seen[s]) { problem("warning", "songs/list.txt", line, `${s} is listed twice (lines ${seen[s]} and ${line}).`, "Each song is only played once. Delete one line."); return; }
      seen[s] = line;
      list.push({ name: s, line });
    });
    if (!list.length) problem("error", "songs/list.txt", 1, "songs/list.txt doesn't list any songs.", "Add one song file name per line, like first-light.txt.");
    return list;
  }

  // input: { album: text or null, list: text or null,
  //          songs: { "name.txt": text or null (missing) }, available: [names] (optional) }
  function build(input) {
    const result = { album: null, list: [], tracks: [], problems: [] };
    const problem = (level, file, line, message, fix) => result.problems.push({ level, file, line, message, fix: fix || "" });
    result.album = parseAlbum(input.album, problem);
    result.list = parseList(input.list, problem);
    for (const item of result.list) {
      const text = input.songs[item.name];
      if (text == null) {
        const near = input.available ? closest(item.name, input.available) : null;
        problem("error", "songs/list.txt", item.line, `songs/list.txt lists ${item.name}, but there's no file songs/${item.name}.`,
          near ? `Did you mean ${near}? File names have to match exactly, including capital letters.`
               : "Check the spelling, including capital letters. To make a new song: Add file → Create new file, and type songs/" + item.name + " as the name.");
        continue;
      }
      result.tracks.push(parseSong(item.name, text, problem));
    }
    const order = ["album.txt", "songs/list.txt"].concat(result.list.map((t) => "songs/" + t.name));
    const rank = (p) => (p.level === "error" ? 0 : 1e7) + (order.indexOf(p.file) + 1) * 1e4 + p.line;
    result.problems.sort((a, b) => rank(a) - rank(b));
    return result;
  }

  // ---------- writing changes back into the text (for the editor) ----------
  // Only the lines that changed are rewritten, so comments and everything
  // else in the file stay exactly as the writer left them.

  function formatRow(inst, toks, steps, labelWidth) {
    const w = Math.max(1, ...toks.map((t) => t.length));
    const beats = steps % 4 === 0 && steps > 4;
    let out = "";
    toks.forEach((t, i) => { if (i) out += beats && i % 4 === 0 ? " | " : " "; out += t.padEnd(w); });
    return (inst + ":").padEnd(labelWidth + 1) + " " + out.trimEnd();
  }

  const labelWidth = (sec, extra) => Math.max(4, ...sec.rows.map((r) => r.inst.length), extra ? extra.length : 0);

  function setRow(song, secName, index, toks) {
    const sec = song.sections[secName], row = sec.rows[index];
    const lines = song.text.split("\n");
    lines[row.line - 1] = formatRow(row.inst, toks, song.steps, labelWidth(sec));
    return lines.join("\n");
  }

  function addRow(song, secName, inst) {
    const sec = song.sections[secName];
    const lines = song.text.split("\n");
    const after = sec.rows.length ? sec.rows[sec.rows.length - 1].line : sec.line;
    lines.splice(after, 0, formatRow(inst, Array(song.steps).fill("."), song.steps, labelWidth(sec, inst)));
    return lines.join("\n");
  }

  function removeRow(song, secName, index) {
    const lines = song.text.split("\n");
    lines.splice(song.sections[secName].rows[index].line - 1, 1);
    return lines.join("\n");
  }

  function setSetting(song, key, value) {
    const lines = song.text.split("\n");
    if (song.at[key]) lines[song.at[key] - 1] = `${key}: ${value}`;
    else {
      const before = song.order.length ? song.sections[song.order[0]].line : lines.length + 1;
      lines.splice(Math.max(0, (song.at.title || before - 1)), 0, `${key}: ${value}`);
    }
    return lines.join("\n");
  }

  const api = {
    DRUMS, MELODIC, THEMES, build, parseSong, parseNote, noteName, closest, tokenize,
    stepSeconds, formatTime, formatRow, setRow, addRow, removeRow, setSetting, kindOf,
  };
  if (typeof module !== "undefined") module.exports = api;
  return api;
})();
