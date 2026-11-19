/* Engine: the automatic Beat check. GitHub runs this on every pull request
   and every change to main (see .github/workflows/check.yml). It runs the
   same checks as the web page, and also makes sure every sound file and the
   cover picture exist. You don't need to edit this file. */

const fs = require("fs");
const path = require("path");
const Beat = require("./song.js");

const root = path.join(__dirname, "..");
const read = (p) => (fs.existsSync(path.join(root, p)) ? fs.readFileSync(path.join(root, p), "utf8") : null);
const songsDir = path.join(root, "songs");
const available = fs.existsSync(songsDir) ? fs.readdirSync(songsDir) : [];

const album = read("album.txt");
const list = read("songs/list.txt");
const names = Beat.build({ album: "", list, songs: {} }).list.map((t) => t.name);
const songs = {};
for (const n of names) songs[n] = available.includes(n) ? read("songs/" + n) : null;
const built = Beat.build({ album, list, songs, available: available.filter((f) => f.endsWith(".txt") && f !== "list.txt") });
const problems = built.problems.slice();

// Uploaded files: the web cares about capital letters, so check the exact spelling.
function findFile(src) {
  let dir = root, real = [];
  for (const part of src.replace(/^\.?\//, "").split("/")) {
    const here = fs.existsSync(dir) && fs.statSync(dir).isDirectory() ? fs.readdirSync(dir) : [];
    if (here.includes(part)) { real.push(part); dir = path.join(dir, part); continue; }
    const nearly = here.find((h) => h.toLowerCase() === part.toLowerCase());
    return { ok: false, suggestion: nearly ? real.concat(nearly).join("/") : null };
  }
  return { ok: true, size: fs.statSync(dir).size };
}

const checked = new Set();
for (const song of built.tracks) {
  for (const [name, s] of Object.entries(song.sounds)) {
    const found = findFile(s.src);
    if (!found.ok) {
      problems.push({ level: "error", file: song.file, line: s.line,
        message: `The sound file ${s.src} for ${name} can't be found.`,
        fix: found.suggestion ? `Did you mean ${found.suggestion}? On the web, capital letters matter.`
          : "Check the spelling. Sounds go in the sounds folder: Add file → Upload files." });
    } else if (found.size > 1.5e6 && !checked.has(s.src)) {
      problems.push({ level: "warning", file: song.file, line: s.line,
        message: `${s.src} is ${(found.size / 1e6).toFixed(1)} MB, which is big for one sound.`,
        fix: "Short sounds load faster. Trim it to a second or two, or save it as .mp3." });
    }
    checked.add(s.src);
  }
}
if (built.album.cover && !/^https?:\/\//i.test(built.album.cover)) {
  const found = findFile(built.album.cover);
  if (!found.ok) {
    problems.push({ level: "error", file: "album.txt", line: built.album.at.cover,
      message: `The cover picture ${built.album.cover} can't be found.`,
      fix: found.suggestion ? `Did you mean ${found.suggestion}? On the web, capital letters matter.`
        : "Check the spelling. Pictures go in the images folder: Add file → Upload files." });
  }
}

// Song files that aren't on the track list never play.
for (const f of available) {
  if (f.endsWith(".txt") && f !== "list.txt" && !names.includes(f)) {
    problems.push({ level: "warning", file: "songs/list.txt", line: 0,
      message: `songs/${f} isn't on the album, because songs/list.txt doesn't list it.`,
      fix: `Add a line to songs/list.txt that says ${f}` });
  }
}

const order = ["album.txt", "songs/list.txt"].concat(names.map((n) => "songs/" + n));
const rank = (p) => (p.level === "error" ? 0 : 1e7) + (order.indexOf(p.file) + 1) * 1e4 + p.line;
problems.sort((a, b) => rank(a) - rank(b));
const errors = problems.filter((p) => p.level === "error");
const warnings = problems.filter((p) => p.level === "warning");
const enc = (s) => String(s).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");

for (const p of problems) {
  const where = p.file + (p.line ? `, line ${p.line}` : "");
  console.log(`${p.level === "error" ? "PROBLEM" : "Heads up"}  ${where}\n  ${p.message}\n  ${p.fix}\n`);
  // These lines make GitHub show the message right next to the line it's about.
  console.log(`::${p.level} file=${p.file}${p.line ? ",line=" + p.line : ""},title=${enc(p.message).replace(/[,:]/g, " ")}::${enc(p.message + " " + p.fix)}`);
}

const minutes = built.tracks.reduce((t, s) => t + s.duration, 0);
const about = `${built.tracks.length} song${built.tracks.length === 1 ? "" : "s"}, ${Beat.formatTime(minutes)} of music`;
const summary = errors.length
  ? `## ✗ The album has ${errors.length} problem${errors.length === 1 ? "" : "s"} to fix`
  : `## ✓ The album checks out`;
const lines = [summary, "", about + ".", ""];
if (built.tracks.length) {
  lines.push("| # | Song | By | Tempo | Length |", "| --- | --- | --- | --- | --- |");
  built.tracks.forEach((s, i) => lines.push(`| ${i + 1} | ${s.title.replace(/\|/g, "\\|")} | ${(s.by || "").replace(/\|/g, "\\|")} | ${s.tempo} | ${Beat.formatTime(s.duration)} |`));
  lines.push("");
}
if (problems.length) {
  lines.push("| | Where | Problem | How to fix it |", "| --- | --- | --- | --- |");
  for (const p of problems) {
    const cell = (s) => String(s).replace(/\|/g, "\\|");
    lines.push(`| ${p.level === "error" ? "🔴" : "🟡"} | ${p.file}${p.line ? " line " + p.line : ""} | ${cell(p.message)} | ${cell(p.fix)} |`);
  }
}
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
console.log(summary.replace(/^## /, "") + ` (${about}, ${warnings.length} heads-up)`);
process.exit(errors.length ? 1 : 0);
