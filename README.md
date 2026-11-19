# Beat Lab

Your team makes an album. Each song is a plain text file: rows of steps like
`kick: x . . . x . . .`, one row per instrument. The website turns the text
into music, right in the browser, and shows every song as a grid that lights
up as it plays.

The instruments are built in, so nobody needs to own any equipment or be a
musician. You can also record your own sounds and play them like drums or
like a keyboard. **No programming needed.**

**Hear it first:** [play the sample album](https://emenriquez.github.io/cs1101-beat-lab/).

> **Start here.** Read this page top to bottom once. It takes about ten minutes.

---

## 1. Set up your team's copy (Day 1)

### One person: the owner

Pick one teammate to own the repository. Everyone else will work in it too.

1. Near the top of this page, click **Use this template** → **Create a new repository**.
2. Name it `beat-lab`, set it to **Public**, and click **Create repository**.
3. **Turn on the live link.** In the new repository: **Settings** → **Pages** →
   under **Branch** choose `main` and `/ (root)` → **Save**. About a minute
   later, the album is live at `https://OWNER-USERNAME.github.io/beat-lab/`.
4. **Invite your teammates.** **Settings** → **Collaborators** →
   **Add people** → type a teammate's GitHub username → **Add**. Repeat for
   each teammate. (GitHub may ask for your password first.)

### Everyone else

1. Open `https://github.com/OWNER-USERNAME/beat-lab/invitations` (use the
   owner's username) and click **Accept invitation**. The same invitation is
   also in your email.
2. Bookmark the team's repository and the live link.

---

## 2. Ways to split the work

The files you'll change:

| File | What it is | Who |
| --- | --- | --- |
| `album.txt` | the album's title, your team name, the color theme, and the liner notes | the owner |
| `songs/list.txt` | the track list: which songs are on the album, in order | anyone (it's shared, see section 6) |
| `songs/*.txt` | one file per song | each song has one writer |
| `sounds/` | sound files you record or find | anyone |

**Everyone writes at least one song of their own.** Beyond that, split it
however suits your team. Some suggestions:

- **2 people:** each writes two songs. One of you also looks after the album
  (title, notes, cover, track order); the other records a custom sound for
  both of you to use.
- **3 people:** each writes a song. Then each person takes a job: **producer**
  (tempo, drums, making the songs feel like one album), **sound designer**
  (records and uploads sounds), **album editor** (cover theme, notes, track order).
- **4 people:** each writes a song, and pairs swap songs for a remix
  (see CHALLENGES.md).

**Your first change (Day 1):** open a song file, put your name after `by:`
(or start your own song file), and get it merged with a pull request (next section).

**Starting a new song:** **Add file** → **Create new file**, type
`songs/your-song-name.txt` as the name (lowercase, dashes, no spaces), and
copy the top of `first-light.txt` as a starting point. Then add a line with
your file's name to `songs/list.txt`, or it won't be on the album.

---

## 3. How to change things: a pull request

On a team, nobody changes `main` directly. `main` is what the live link
plays, so it's the version everyone shares. Instead you **propose** a change,
a teammate **reviews** it, and then it's **merged** into `main`. That's a
**pull request**.

### Making a pull request

1. Open your file (for example `songs/night-drive.txt`) and click the
   **pencil** icon (*Edit this file*).
2. Make your change.
3. **Hear it first** (recommended): select everything in the editor
   (<kbd>Ctrl</kbd>+<kbd>A</kbd>, or <kbd>⌘</kbd>+<kbd>A</kbd> on a Mac), copy
   it, open your team's live link and click **Test a draft**. See section 5.
4. Back in GitHub, click **Commit changes...**. Write a message that says
   what you changed, like `Add a chorus to Night Drive`.
5. Choose **Create a new branch for this commit and start a pull request**,
   then click **Propose changes**.
6. On the next page, fill in the description and click **Create pull request**.
7. Wait about 30 seconds for the **Beat check** at the bottom of the page.
   - ✓ green: the check found nothing wrong. Ask a teammate to review.
   - ✗ red: click **Details** to see what to fix. To fix it, go to the
     **Files changed** tab, click the **⋯** menu on your file → **Edit file**,
     and commit again. Your fix goes into the same pull request.

### Reviewing a teammate's pull request

1. Open the **Pull requests** tab and click their pull request.
2. Click **Files changed** and read every line. Green lines were added; red
   lines were removed.
3. **Listen to it.** On the file's **⋯** menu, click **View file**, then the
   **Copy raw file** button. Paste it into **Test a draft** on the live link.
4. Click **Review changes** (or **Submit review**). Choose:
   - **Approve** if it's ready, or
   - **Request changes** if something is wrong, with a comment that says
     exactly what and where.
5. Once it's approved, open the **Conversation** tab and click
   **Merge pull request** → **Confirm merge**. The live link updates about a
   minute later.

Don't merge your own pull request until a teammate has approved it.

---

## 4. Song cheat sheet

```text
# Night Drive                  the title (one # sign)
by: Sam                        who wrote it
tempo: 96                      beats per minute, 40 to 220
steps: 16                      steps in every section (4 steps = 1 beat)
swing: 20%                     optional: makes it bounce (0% to 50%)
volume: hat 60%                optional: quieter or louder (100% is normal)
sound: cowbell = sounds/cowbell.wav    optional: your own sound

## verse                       starts a section: a pattern of steps
kick:  x . . . | x . . . | x . . . | x . . .
snare: . . . . | x . . . | . . . . | x . . .
bass:  C2 - - . | . . C2 . | G1 - - . | . . . .
pad:   C4+E4+G4 - - - | - - - - | - - - - | - - - -

play: intro, verse x2, chorus, verse x2, chorus
```

- **Drums** (`kick`, `snare`, `hat`, `clap`, `tom`): `x` is a hit, `X` is a
  loud hit, `.` is a rest.
- **Melody** (`bass`, `lead`, `pad`, `pluck`): write notes like `C4`, `F#3`
  or `Bb2`. The letter is the note (A to G), `#` means sharp and `b` means
  flat, and the number is how high (C4 is the middle of a piano). `-` holds
  the note before it for another step. `C4+E4+G4` plays three notes at once
  (a chord).
- **Every row in a song has the same number of steps** (the `steps:` number).
  The `|` marks are only there to help you count beats. Leave them out if you like.
- **Sections** are patterns. `play:` says what order they go in, and `x2`
  repeats one. Reusing a section is how a song gets a chorus.
- **Your own sounds:** record or find a short sound, upload it to the
  `sounds` folder (**Add file** → **Upload files**), then add a line like
  `sound: dog = sounds/dog-bark.wav` at the top of your song. Now `dog:` rows
  work like drums. Write notes instead of `x` to play your sound higher or
  lower (`C4` is its normal pitch).
- Lines between `<!--` and `-->` are notes for writers. Nobody hears them.

### Recording a sound

- **Easiest:** on your live link, click **Record a sound**. Record up to 3
  seconds, listen, name it, and download it as a `.wav` file. It trims the
  silence at the start for you, and tells you the exact `sound:` line to add.
  Then upload the file to the `sounds` folder.
- **On a phone:** use the voice memo or sound recorder app, then send the
  file to yourself. File types that work: `.wav`, `.mp3`, `.ogg`, `.m4a`, `.webm`.
- Keep sounds **short** (a second or two). Use a lowercase name with dashes,
  like `dog-bark.wav`, and type it in your song exactly the same way, capital
  letters and all.
- Only use sounds you made yourself or that are clearly free to use, and say
  where they came from in your pull request.

---

## 5. Tools on the live site

| Button | Does |
| --- | --- |
| **▶ Play** / **■ Stop** | plays the selected song. The grid lights up the step you're hearing. |
| **M** / **S** | mute an instrument, or solo it (hear only that one) |
| Section tabs | show a different section. `×3` means it plays three times. |
| **✎ Edit** | change the song by clicking squares (see below) |
| **Test a draft** | paste a song file you're still writing and hear it, without committing anything |
| **Download as WAV** | saves the selected song as a sound file you can share |
| **Record a sound** | records a short sound from your microphone and saves it as a `.wav` file to upload |
| **✓ No problems** / **⚠ problems** | lists every mistake found, with the file, the line and how to fix it |

Keys: <kbd>Space</kbd> play / stop, <kbd>E</kbd> edit, <kbd>←</kbd> <kbd>→</kbd>
previous / next song. Add `?track=2` to the end of the address to open the
second song.

### Edit mode

Click **✎ Edit** to change a song by clicking. Click a drum square to switch
it between hit, loud hit and rest. Click a melody square to pick a note.
**Loop this section** plays the section over and over while you work, and you
can change the tempo and add or remove rows.

Your changes are only in your browser until you save them on GitHub:

1. Click **Copy as text**, then **Copy**.
2. On GitHub, open the song file, click the pencil, select everything and paste.
3. Commit it as a pull request, as in section 3.

The text file is always the real song. Edit mode just writes the text for you.

---

## 6. When something goes wrong

- The **problems** button turns red when a song has a mistake. It tells you
  the file, the line and the usual fix. Fix the first one, then check again.
- The **Beat check** on every pull request runs the same checks, so mistakes
  get caught before they reach `main`.
- A merged pull request broke something? Open it and click **Revert**. That
  makes a new pull request that undoes it.

### "This branch has conflicts that must be resolved"

This will happen to your team at least once, usually in `songs/list.txt`.
Two pull requests changed the same lines, and GitHub can't tell which one
you want. For example, two people each added their song to the bottom of the
track list.

1. Click **Resolve conflicts**. GitHub shows both versions between markers:
   ```text
   <<<<<<< your-branch
   night-drive.txt
   =======
   rainy-day.txt
   >>>>>>> main
   ```
2. Edit the text so it says what you actually want. For a track list, that's
   usually **both** lines, in the order you want them.
3. Delete the three marker lines (`<<<<<<<`, `=======` and `>>>>>>>`).
4. Click **Mark as resolved** → **Commit merge**. The Beat check runs again.

---

## More

- [CHALLENGES.md](CHALLENGES.md): the challenges, and getting ready for show and tell.
- [docs/HOW-IT-WORKS.md](docs/HOW-IT-WORKS.md): how text becomes sound, and a tour of every file.
- [docs/IDEAS.md](docs/IDEAS.md): **optional** bigger features, if your team wants to go further.
- Found something that doesn't work right? **Issues** → **New issue** → **Bug report**.
