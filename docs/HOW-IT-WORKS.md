# How it works

You don't need any of this to make your album. It's here so the project
doesn't feel like a black box.

## The files

```
beat-lab/
├── index.html              the page: loads the engine
├── README.md               start here
├── CHALLENGES.md           the challenges
├── album.txt               ← the album's title, theme and notes
├── songs/                  ← YOUR TEAM'S SONGS
│   ├── list.txt            the track list
│   └── *.txt               one file per song
├── sounds/                 sounds you upload
├── images/                 a cover picture, if you want one
├── engine/                 ← the machinery (about 2,000 lines)
│   ├── song.js             reads the text files and checks them for mistakes
│   ├── synth.js            the instruments, and turning a song into sound
│   ├── player.js           the album page, the grid, and playing in time
│   ├── editor.js           Edit mode and "Copy as text"
│   ├── draft.js            the "Test a draft" panel
│   ├── recorder.js         "Record a sound"
│   ├── check-cli.js        the Beat check that GitHub runs on pull requests
│   └── style.css           how the page looks, including the four themes
├── .github/
│   ├── workflows/check.yml         tells GitHub when to run the Beat check
│   ├── pull_request_template.md    the reviewer checklist on every pull request
│   └── ISSUE_TEMPLATE/             the bug report form
└── docs/
    ├── HOW-IT-WORKS.md     you are here
    └── IDEAS.md            optional bigger features
```

## Sound is a wave, and a wave is numbers

When you hear a sound, the air is pushing on your ears, back and forth,
very fast. A speaker makes sound by moving back and forth the same way. The
line under the grid on the live site shows that movement while a song plays:
up is "push out", down is "pull in".

A computer can't store a smooth wave, so it stores **samples**: it measures
where the wave is, tens of thousands of times a second, and keeps each
measurement as a number. Your browser uses 44,100 or 48,000 samples per
second (it shows which in the bottom bar when you press play). That number
is the **sample rate**. Played back fast enough, the numbers sound smooth.

That's why a WAV file is big: it's just every sample, one after another.
44,100 samples a second, 2 speakers, 2 bytes per sample is 176,400 bytes for
every second of music. (MP3 files are smaller because they throw away
details your ears are unlikely to notice. That's called **compression**.)

## Where the instruments come from

Every built-in instrument is made from a few simple ingredients:

- **Oscillators** make a pure, repeating wave: a smooth *sine* (soft, like a
  whistle), a *triangle*, a buzzy *sawtooth* or a hollow *square*.
- **Noise** is random numbers. It sounds like "shhh", which is the start of
  every snare, hat and clap.
- **Filters** remove the high or low part of a sound, making it darker or thinner.
- **Envelopes** shape the volume over time. A drum is loud at once and fades
  fast. A pad fades in slowly.

A kick drum, for example, is a sine wave that starts at 150 vibrations per
second and slides down to 45 in about a tenth of a second, fading out as it
goes. Open `engine/synth.js` to see every recipe.

## How a note becomes a number

Every note has a **frequency**: how many times a second its wave repeats.
The A above middle C (`A4`) is 440 per second (440 Hz). Each step up the
piano multiplies the frequency by the same amount, and 12 steps up (one
**octave**) doubles it: `A5` is 880 Hz and `A3` is 220 Hz. That doubling is
why notes an octave apart sound like "the same note, higher".

When you write `F#3`, the engine counts how many piano keys that is from
`A4` and works out the frequency from there.

## Tempo math

`tempo: 120` means 120 beats per minute, so one beat lasts 60 ÷ 120 = 0.5
seconds. Each beat is 4 steps, so one step lasts 0.125 seconds.

A song's length is just multiplication: every section played (counting
repeats) × steps per section × seconds per step. The site does that sum to
show each song's length.

## Playing exactly on time

Web pages are busy. If the engine waited for the exact moment of each note
and *then* played it, some notes would come out a little late, and you'd
hear the beat wobble.

So it plans ahead. About 40 times a second, it looks at the next 0.15
seconds of the song and tells the browser's audio system exactly when each
sound should start, to the thousandth of a second. The audio system has its
own very precise clock and plays them right on time, even if the page is
busy for a moment. The grid's lights follow the same clock.

## Sections are reusable patterns

A section is written once and played as many times as `play:` says. That's
the same idea programmers use all the time: write something once, give it a
name, and use the name wherever you need it. A programmer would call a
section a *function*, and `play:` a list of calls to it. When you fix a
mistake in your chorus, every chorus in the song is fixed at once.

## The text is the real song

Edit mode looks like a music app, but it never stores the song anywhere
except the text. Each click rewrites one line of the text, and the page reads
the text again. That's why **Copy as text** always gives you exactly what
you're hearing, and why a pull request shows only the lines you changed.
