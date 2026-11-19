# Going further (optional)

Everything here is **optional**. The project can be completed in full
without anything on this page, and without using AI at all.

These ideas are for teams that have done the challenges and want more. Some
need nothing new. Others need changes to the engine, which is where an AI
assistant can help, as long as **you stay in charge of checking its work**.

---

## No new skills needed

- **A concept album.** Every song tells part of one story. Use the `about:`
  notes to tell it.
- **Same tune, different feel.** Write one melody, then make three versions:
  slow and sad, fast and happy, swung. What changes the mood most?
- **Found-sound drum kit.** Record kick, snare and hat from things around you
  (a desk thump, a book slap, keys jingling) and replace all the built-in
  drums in one song.
- **Odd time.** Try `steps: 12` (3 beats) for a waltz, or `steps: 20`
  (5 beats). Does it still feel like music?

---

## With an AI assistant

### Rules for working with AI on code

1. **Work on a branch.** Every change goes through a pull request anyway, so
   nothing reaches `main` until a teammate has reviewed it.
2. **Give it context.** It hasn't seen this project. Tell it this is a
   browser music player made of plain JavaScript files with no libraries:
   song files are read and checked in `engine/song.js`, instruments live in
   `engine/synth.js`, and the page is `engine/player.js`. Paste in the files
   it needs to see.
3. **Ask it to explain before you accept.** "Before you change anything, tell
   me which files you'll change and why." If you can't follow the
   explanation, ask again until you can.
4. **New writing rules need new checks.** If the feature adds something new
   to song files (like an `echo:` line), `engine/song.js` has to learn it
   too. Otherwise the Beat check will call your new line a mistake and your
   pull request will go red.
5. **Test it yourself**, with the "check it" list for each idea, and have a
   teammate who didn't build it try it.
6. **Say so in the pull request**, like `Add an echo effect (AI-assisted)`,
   and write one thing the AI got wrong the first time and how you noticed.

### Ideas

**A new instrument** · easier
Ask for a new built-in instrument in `synth.js`, like a `bell`, `organ` or `wobble` bass.
*Check it:* it plays notes at the right pitch (compare it with `pluck` on the same notes);
a typo like `bel:` still gets a "Did you mean bell?" message; it works in Edit mode.

**Echo** · medium
A setting like `echo: lead 30%` that repeats an instrument's sound, quieter each time.
*Check it:* only that instrument echoes; `echo: 0%` sounds the same as no echo;
the WAV download has the echo too; a bad value gets a clear message.

**Play it live** · medium
Press keys on the computer keyboard (A, S, D, F...) to play notes on any instrument while the song plays.
*Check it:* every key plays the note it says; holding a key doesn't repeat
forever; typing in Test a draft doesn't trigger notes.

**A better visualizer** · medium
Replace the wave line with bars that jump with the music (a "spectrum"), using the analyser that's already there.
*Check it:* it moves with the music and stops when the music stops; it
looks right in all four themes and on a phone.

**Chord names** · harder
Write `pad: Cmaj - - - Am - - -` instead of spelling out every note.
*Check it:* `Cmaj` sounds the same as `C4+E4+G4`; minor chords sound sadder;
a misspelled chord gets a clear message; Edit mode still works.
