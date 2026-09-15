# sloptris audio assets

Drop files here using the exact names below. They are read by the cue manifest at
the top of `../audio.js`. No code change is needed when a file appears.

Every file is optional. When one is missing or fails to decode, that cue plays a
short synthesized fallback instead, so the game is fully playable with this
folder empty. The one exception is `loop.mp3`: music has no fallback, and a
missing `loop.mp3` simply means no music.

A page opened straight from disk with `file://` cannot usually read these files,
so serve the folder over http (Live Server or any static server) to hear real
assets. The synthesized fallbacks work either way.

Expected files, one per cue:

    wb_toggle.mp3      wb_toggle
    wb_reject.mp3      wb_reject
    build.mp3          build
    generate.mp3       generate
    move.mp3           move
    rotate.mp3         rotate
    soft_drop.mp3      soft_drop
    hard_drop.mp3      hard_drop
    lock.mp3           lock
    clear.mp3          clear
    mutate_beat.mp3    mutate_beat
    mutate.mp3         mutate
    refactor.mp3       refactor
    review_charge.mp3  review_charge (looped, pitched by playback rate)
    pulse_stable.mp3   pulse_stable
    pulse_mutate.mp3   pulse_mutate
    sprint.mp3         sprint
    deadline_warn.mp3  deadline_warn
    typing.mp3         typing (very quiet; can be disabled in the manifest)
    topout.mp3         topout
    loop.mp3           music (looped, no fallback)
