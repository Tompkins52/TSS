# Witch Card video

How the one-minute video on the Witch Card product page is made, so it can be remade when
the app or the script changes.

## The parts

| Part | Where it comes from |
|---|---|
| Script and shot list | Google Doc "Witch Card video script and shot list" in the TSS Marketing folder |
| Keyframes (the drawn frames the cartoon starts from) | `toon/scene.html` draws them in code; `python3 toon/render.py` writes `keyframes/k1.png` .. `k5.png` |
| Cartoon clips | ElevenLabs flow "Witch Card product video": each keyframe is the start frame of an 8-second clip (Google Veo 3.1 Lite, 16:9, 720p). About 2,400 credits a clip. |
| Narration | ElevenLabs text to speech, voice Monotone Mike, model eleven_v4. About 700 credits a take. The transcription of the chosen take gives the per-word timings (`words.json`). |
| Music | ElevenLabs Music, one 60-second instrumental. About 900 credits. |
| Ending | The mascot flying across the moon, made in Gemini from the app icon. |
| Phone demo | Recorded from the real app by `tools/record_demo.py` with the sample wallet standing in a grocery store. |

## Building it

Put the parts in one folder: `clip1.mp4` .. `clip5.mp4`, `voice.mp3`, `words.json`, `music.mp3`,
`outro.mp4`. Then, with a checkout of the app next to this repository (or `DEMO_APP` pointing at one):

    python3 tools/build_video.py --assets <folder> --out marketing/witch-card/witch-card.mp4

The build finds where each sentence sits in the narration, puts each paragraph on its clip,
re-records the phone demo so its captions land on the narrator's words, ducks the music under
the voice, burns captions for muted autoplay, and writes the MP4 with a poster frame.

The copy on the site is `src/assets/video/witch-card.mp4`, encoded from the master at CRF 23
so it stays around ten megabytes:

    ffmpeg -i marketing/witch-card/witch-card.mp4 -c:v libx264 -preset slow -crf 23 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart src/assets/video/witch-card.mp4

The master itself is not kept in the repository.

## Notes from the first one (November 2026)

- The models hold the drawn characters well for five or six seconds and drift after that;
  `USABLE` in the build script says how much of each clip is used, and the first clip's last
  beat is covered by a slow push-in on the drawn frame.
- Narration gaps are kept close to the narrator's own breaths; adding air between lines made it
  feel like it was pausing between clips.
- The music sits about 17 dB under the voice and dips further while the narrator talks.
