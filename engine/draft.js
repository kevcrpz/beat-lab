/* Engine: the draft tester. Paste a song file you're still writing and hear
   it before you commit anything.
   You don't need to edit this file. */

const Draft = (() => {
  const SAVE = "beatlab-draft:" + location.pathname;
  const NEW = "draft.txt";

  function open(name) {
    const S = App.state;
    let saved = null;
    if (name) saved = { as: name, text: S.over[name] != null ? S.over[name] : S.live.songs[name] || "" };
    if (!saved) { try { saved = JSON.parse(sessionStorage.getItem(SAVE)); } catch (e) { saved = null; } }
    saved = saved || { as: NEW, text: "" };

    const body = document.createElement("div");
    body.className = "draft-form";
    body.innerHTML = `
      <p>Paste a song file here to hear it. Nothing is saved to GitHub, and nobody else hears it.</p>
      <ol>
        <li>In GitHub, open your song file and click the pencil to edit it. Select everything (<kbd>Ctrl</kbd>+<kbd>A</kbd>, or <kbd>⌘</kbd>+<kbd>A</kbd> on a Mac) and copy it.</li>
        <li>Paste it below, choose which song it is, and click <strong>Play this draft</strong>.</li>
        <li>When it sounds right, go back to GitHub and commit.</li>
      </ol>
      <label>This draft is:
        <select id="draft-as"></select>
      </label>
      <textarea id="draft-text" spellcheck="false" placeholder="# My Song&#10;tempo: 100&#10;steps: 16&#10;&#10;## beat&#10;kick:  x . . . | x . . . | x . . . | x . . .&#10;snare: . . . . | x . . . | . . . . | x . . .&#10;&#10;play: beat x4"></textarea>
      <div class="draft-buttons">
        <button type="button" id="draft-play">Play this draft</button>
        <button type="button" id="draft-check">Just check it</button>
      </div>
      <div id="draft-problems"></div>`;
    const sel = body.querySelector("#draft-as");
    const opts = [[NEW, "a new song (just for testing)"]]
      .concat(S.built.list.filter((t) => S.live.songs[t.name] != null).map((t) => [t.name, `my changes to ${t.name} (replaces it while testing)`]));
    for (const [v, label] of opts) {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = label;
      sel.appendChild(o);
    }
    sel.value = opts.some((o) => o[0] === saved.as) ? saved.as : NEW;
    const text = body.querySelector("#draft-text");
    text.value = saved.text;

    const read = () => {
      const d = { as: sel.value, text: text.value };
      try { sessionStorage.setItem(SAVE, JSON.stringify(d)); } catch (e) { /* storage is off */ }
      return d;
    };
    const showProblems = (d) => {
      const list = [];
      Beat.parseSong(d.as, d.text, (level, file, line, message, fix) => list.push({ level, file, line, message, fix }));
      list.sort((a, b) => (a.level === b.level ? a.line - b.line : a.level === "error" ? -1 : 1));
      const box = body.querySelector("#draft-problems");
      box.innerHTML = "";
      const h = document.createElement("h3");
      h.textContent = list.length ? "Problems in this draft" : "No problems in this draft";
      box.append(h, App.problemList(list));
      return list;
    };
    body.querySelector("#draft-check").onclick = () => showProblems(read());
    body.querySelector("#draft-play").onclick = () => {
      const d = read();
      if (!d.text.trim()) { showProblems(d); return; }
      if (d.as === NEW) App.addDraft(NEW, d.text);
      else {
        App.setText(d.as, d.text);
        App.select(App.tracks().findIndex((t) => t.name === d.as));
      }
      App.closePanel();
      App.play();
    };
    if (saved.text) showProblems(saved);
    App.openPanel("Test a draft", body);
    text.focus();
  }

  return { open, NEW };
})();
