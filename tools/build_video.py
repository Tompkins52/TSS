"""Assemble the Witch Card promo from its parts.

Parts, in one folder (--assets):
    clip1.mp4 .. clip5.mp4   the animated opening, one clip per beat of the story
    voice.mp3                the narration, one take
    words.json               per-word timings of that take (from the transcription), optional
    music.mp3                the instrumental bed, optional
    outro.mp4                the mascot flying across the moon, optional (the stage's own end card otherwise);
                             its first three seconds are used, then the last frame holds under the address
The phone demo (the last stretch) is recorded by tools/record_demo.py, re-timed to the
narration, so the captions land on the narrator's words.

    python3 tools/build_video.py --assets assets/ --out marketing/witch-card/witch-card.mp4

What it does: finds where each sentence of narration sits, cuts the picture to the narration
(which plays once, untouched), records the demo with beats taken from the narration,
ducks the music under the voice, writes the spoken lines as a WebVTT caption file (the page shows
it only with the sound off), and writes the MP4 plus a poster frame next to it.
"""
import argparse
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT_DIR = os.path.join(ROOT, "tools", "demo")
KEYFRAME = os.path.join(ROOT, "marketing", "witch-card", "keyframes", "k1@2x.png")

# The narration, paragraph by paragraph, sentence by sentence. Captions come from here.
SCRIPT = [
    ["So this is Dave.", "Dave has five credit cards.", "Dave has no idea what any of them do."],
    ["The bank mailed him a forty-seven page booklet once.", "He used it to level a table."],
    ["So Dave grabs the blue one.", "The blue one earns one percent on groceries.", "The green one earns five.", "Dave will never know this."],
    ["His money app wanted to help.", "It offered him a sixth card."],
    ["Nobody was going to tell Dave which card to use.", "Well.", "Almost nobody."],
    ["Witch Card.", "Open it at the register.", "It knows where you are, and pulls out the card that earns the most.", "The rest of your wallet sits under it, ranked."],
    ["No ads.", "No sponsors.", "Ninety-nine cents, once."],
    ["tompkinssoftwaresystems.com/witch-card"],
]
# How much of each clip is good (the models drift near the end).
USABLE = [5.4, 6.5, 8.0, 6.0, 8.0]
LEAD = 0.2   # each cut lands this long before the paragraph's first word
SLOW_MAX = 1.25  # a clip may be slowed this much before its last frame is held
OUTRO_CLEAN = 2.98  # seconds of the outro clip before its own title text starts to show


def run(cmd):
    return subprocess.run(cmd, check=True, capture_output=True, text=True)


def duration(path):
    return float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path]).stdout.strip())


def silences(path, floor_db=-34, min_len=0.22):
    err = subprocess.run(["ffmpeg", "-hide_banner", "-i", path, "-af", "silencedetect=n=%ddB:d=%.2f" % (floor_db, min_len), "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    out, start = [], None
    for line in err.splitlines():
        if "silence_start:" in line:
            start = float(line.split("silence_start:")[1].split()[0])
        elif "silence_end:" in line and start is not None:
            out.append((start, float(line.split("silence_end:")[1].split()[0])))
            start = None
    return out


def sentences_from_words(words):
    """Sentence spans from per-word timings: a sentence ends at a word ending in a period."""
    out, start = [], None
    for w in words:
        if start is None:
            start = w["start"]
        if w["text"].rstrip('"').endswith((".", "!", "?")):
            out.append((start, w["end"]))
            start = None
    if start is not None:
        out.append((start, words[-1]["end"]))
    return out


def align(voice):
    """Without word timings: match the sentences to the stretches of speech between pauses,
    by expected length, allowing a stretch to hold up to three sentences or a sentence to span two."""
    total = duration(voice)
    gaps, spans, t = silences(voice), [], 0.0
    for s, e in gaps:
        if s - t > 0.12:
            spans.append((t, s))
        t = e
    if total - t > 0.12:
        spans.append((t, total))
    sents = [x for p in SCRIPT for x in p]
    chars = [len(x) for x in sents]
    rate = sum(e - s for s, e in spans) / float(sum(chars))
    exp = [c * rate for c in chars]
    n, m = len(sents), len(spans)
    INF = float("inf")
    best = [[INF] * (m + 1) for _ in range(n + 1)]
    back = [[None] * (m + 1) for _ in range(n + 1)]
    best[0][0] = 0.0

    def cost(i0, i1, j0, j1):
        want = sum(exp[i0:i1])
        got = sum(spans[j][1] - spans[j][0] for j in range(j0, j1))
        return abs(want - got) / max(want, 0.3) + 0.2 * ((i1 - i0 - 1) + (j1 - j0 - 1))

    for i in range(n + 1):
        for j in range(m + 1):
            if best[i][j] == INF:
                continue
            for di, dj in ((1, 1), (2, 1), (3, 1), (1, 2)):
                if i + di <= n and j + dj <= m:
                    c = best[i][j] + cost(i, i + di, j, j + dj)
                    if c < best[i + di][j + dj]:
                        best[i + di][j + dj] = c
                        back[i + di][j + dj] = (di, dj)
    if best[n][m] == INF:
        raise SystemExit("could not match the script to the narration (%d sentences, %d stretches)" % (n, m))
    steps, i, j = [], n, m
    while i or j:
        di, dj = back[i][j]
        steps.append((i - di, i, j - dj, j))
        i, j = i - di, j - dj
    times = [None] * n
    for i0, i1, j0, j1 in reversed(steps):
        s0, e1 = spans[j0][0], spans[j1 - 1][1]
        tot, t = sum(chars[i0:i1]), s0
        for k in range(i0, i1):
            d = (e1 - s0) * chars[k] / tot
            times[k] = (t, t + d)
            t += d
    return times


def narration(voice, words_path):
    sents = [x for p in SCRIPT for x in p]
    times = None
    if words_path and os.path.exists(words_path):
        with open(words_path) as f:
            times = sentences_from_words(json.load(f))
        if len(times) != len(sents):
            print("word timings give %d sentences, script has %d; falling back to pause matching" % (len(times), len(sents)))
            times = None
    if times is None:
        times = align(voice)
    print("narration, sentence by sentence:")
    for (a, b), x in zip(times, sents):
        print("  %5.2f-%5.2f  %s" % (a, b, x))
    bounds, sent, k = [], [], 0
    for p in SCRIPT:
        bounds.append((times[k][0], times[k + len(p) - 1][1]))
        for x in p:
            sent.append((times[k][0], times[k][1], x))
            k += 1
    return bounds, sent


ASS_HEAD = """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,TSS Caption,54,&H00FFFFFF,&H00FFFFFF,&H00000000,&H82000000,0,0,0,0,100,100,0,0,3,14,0,2,160,160,54,1
Style: Url,TSS Caption,84,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,4,2,5,40,40,0,1
Style: Tag,TSS Caption,42,&H00FFA3C4,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,3,1,5,40,40,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""


def ts(t):
    t = max(0.0, t)
    return "%d:%02d:%05.2f" % (int(t // 3600), int(t % 3600 // 60), t % 60)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--assets", required=True)
    ap.add_argument("--out", default=os.path.join(ROOT, "marketing", "witch-card", "witch-card.mp4"))
    ap.add_argument("--demo", help="use this demo recording instead of recording one")
    ap.add_argument("--music-db", type=float, default=-18.0, help="music level under the voice")
    ap.add_argument("--burn-captions", action="store_true", help="burn the spoken lines into the picture (a copy for places without caption tracks)")
    args = ap.parse_args()
    A = args.assets
    clips = [os.path.join(A, "clip%d.mp4" % i) for i in range(1, 6)]
    voice, music, outro = os.path.join(A, "voice.mp3"), os.path.join(A, "music.mp3"), os.path.join(A, "outro.mp4")
    for p in clips + [voice]:
        if not os.path.exists(p):
            raise SystemExit("missing " + p)
    has_music, has_outro = os.path.exists(music), os.path.exists(outro)
    work = os.path.join(A, "build")
    os.makedirs(work, exist_ok=True)

    bounds, sent = narration(voice, os.path.join(A, "words.json"))

    # --- timeline ----------------------------------------------------------------------
    # The narration plays once, untouched, starting LEAD seconds in; the picture cuts to it.
    # Paragraph i sits on clip i, each cut landing LEAD before the paragraph's first word.
    # The first paragraph's last sentence lands on a slow push-in over the drawn frame of
    # Dave, since that clip is only good for a few seconds.
    voice_at = [b0 + LEAD for b0, _ in bounds]       # where each paragraph starts on the timeline
    cuts = [b0 for b0, _ in bounds]                    # where the picture cuts, voice time = timeline
    segs = [{"clip": i, "start": cuts[i], "length": cuts[i + 1] - cuts[i]} for i in range(5)]
    skit_end = cuts[5]
    p6, p7, p8 = voice_at[5], voice_at[6], voice_at[7]
    end = bounds[7][1] + LEAD + 0.35   # a beat after the last word, no hold
    s6 = sent[sum(len(p) for p in SCRIPT[:5]):sum(len(p) for p in SCRIPT[:6])]
    rel = lambda v: v + LEAD - skit_end                # voice time -> seconds into the demo
    beats = {
        "title": 0.0,
        "open": rel(s6[1][0]),
        "knows": rel(s6[2][0]),
        "pulls": rel(s6[2][0]) + 1.15,
        "ranked": rel(s6[3][0]),
        "pledge": rel(bounds[6][0]),
        "end": cuts[7] - skit_end,
        "stop": end - skit_end + 0.8,
    }
    demo_len = (cuts[7] - skit_end) if has_outro else (end - skit_end)
    print("demo beats:", json.dumps({k: round(v, 2) for k, v in beats.items()}))
    print("length %.1fs: skit %.1fs, demo %.1fs, outro %.1fs" % (end, skit_end, demo_len, end - skit_end - demo_len))

    demo = args.demo
    if not demo:
        beats_path = os.path.join(work, "beats.json")
        with open(beats_path, "w") as f:
            json.dump(beats, f)
        demo = os.path.join(work, "demo.mp4")
        subprocess.run([sys.executable, os.path.join(ROOT, "tools", "record_demo.py"), "--beats", beats_path, "--out", demo], check=True)

    # --- captions ------------------------------------------------------------------------
    # The spoken lines go to a WebVTT file next to the output, for the page to show only when
    # the sound is off. The address at the end is part of the picture, so it is always burned in.
    def vtt_ts(t):
        t = max(0.0, t)
        return "%02d:%02d:%06.3f" % (int(t // 3600), int(t % 3600 // 60), t % 60)
    caps, cues, k = [], [], 0
    for i, p in enumerate(SCRIPT):
        for _ in p:
            a, b, text = sent[k]
            nxt = sent[k + 1][0] if k + 1 < len(sent) else b + 1.0
            k += 1
            # Hold a caption a beat past its last word, but never into the next line.
            t0, t1 = a + LEAD, min(b + 0.25, nxt - 0.04) + LEAD
            if i == 7:
                caps.append("Dialogue: 0,%s,%s,Url,,0,0,0,,{\\pos(960,860)\\fad(300,0)}tompkinssoftwaresystems.com{\\c&H7ED6FF&}/witch-card" % (ts(t0), ts(end)))
                caps.append("Dialogue: 0,%s,%s,Tag,,0,0,0,,{\\pos(960,950)\\fad(300,0)}Add it to your home screen. No account. No app store." % (ts(t0 + 0.9), ts(end)))
                cues.append("%s --> %s\n%s" % (vtt_ts(t0), vtt_ts(min(t1, end)), "tompkinssoftwaresystems.com/witch-card"))
                continue
            cues.append("%s --> %s\n%s" % (vtt_ts(t0), vtt_ts(t1), text))
            if args.burn_captions and i not in (5, 6):   # the stage shows the demo's words big, beside the phone
                caps.append("Dialogue: 0,%s,%s,Cap,,0,0,0,,%s" % (ts(t0), ts(t1), text))
    with open(os.path.join(work, "captions.ass"), "w", encoding="utf-8") as f:
        f.write(ASS_HEAD + "\n".join(caps) + "\n")
    vtt = os.path.splitext(args.out)[0] + ".vtt"
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(vtt, "w", encoding="utf-8") as f:
        f.write("WEBVTT\n\n" + "\n\n".join(cues) + "\n")

    # --- ffmpeg --------------------------------------------------------------------------
    inputs, fc = [], []
    n_in = 0

    def add_input(path):
        nonlocal n_in
        inputs.extend(["-i", path])
        n_in += 1
        return n_in - 1

    def clip_chain(idx, src_len, need, label):
        """Scale a clip to the frame, slow it a little if the narration runs long, hold the last frame after that."""
        slow = min(SLOW_MAX, max(1.0, need / src_len))
        fc.append("[%d:v]trim=duration=%.3f,setpts=(PTS-STARTPTS)*%.4f,scale=1920:1080:flags=lanczos,fps=30,setsar=1,"
                  "tpad=stop_mode=clone:stop_duration=8,trim=duration=%.3f,setpts=PTS-STARTPTS[%s]" % (idx, src_len, slow, need, label))

    # Segment 1: the clip up to the third sentence, then the push-in on the drawn frame.
    s1_cut = sent[2][0] + LEAD - cuts[0]
    i0 = add_input(clips[0])
    clip_chain(i0, min(USABLE[0], s1_cut), s1_cut, "v0a")
    push = segs[0]["length"] - s1_cut
    frames = int(round(push * 30))
    kf = KEYFRAME if os.path.exists(KEYFRAME) else os.path.join(ROOT, "marketing", "witch-card", "keyframes", "k1.png")
    k_in = add_input(kf)
    inputs[-2:] = ["-loop", "1", "-i", kf]  # a still, looped so zoompan has frames to eat
    fc.append("[%d:v]scale=3840:2160:flags=lanczos,zoompan=z='1.12+0.0045*on':x='1760-(iw/zoom)/2':y='880-(ih/zoom)/2':d=%d:s=1920x1080:fps=30,"
              "trim=duration=%.3f,setpts=PTS-STARTPTS[v0b]" % (k_in, frames, push))
    labels = ["v0a", "v0b"]
    for i in range(1, 5):
        idx = add_input(clips[i])
        clip_chain(idx, USABLE[i], segs[i]["length"], "v%d" % i)
        labels.append("v%d" % i)
    d_in = add_input(demo)
    fc.append("[%d:v]scale=1920:1080,fps=30,setsar=1,trim=duration=%.3f,setpts=PTS-STARTPTS[vd]" % (d_in, demo_len))
    labels.append("vd")
    if has_outro:
        o_in = add_input(outro)
        o_len = end - skit_end - demo_len
        # The clip's own title text fades in at OUTRO_CLEAN seconds, so the flight is slowed a little
        # to fill the time up to it; the video then fades out with the mascot still gliding, no hold.
        rate = OUTRO_CLEAN / o_len
        fc.append("[%d:v]trim=duration=%.3f,setpts=(PTS-STARTPTS)/%.4f,scale=1920:1080:flags=lanczos,fps=30,setsar=1,"
                  "tpad=stop_mode=clone:stop_duration=2,trim=duration=%.3f,setpts=PTS-STARTPTS[vo]" % (o_in, OUTRO_CLEAN, rate, o_len))
        labels.append("vo")
    fc.append("".join("[%s]" % l for l in labels) + "concat=n=%d:v=1:a=0[vcat]" % len(labels))
    fc.append("[vcat]ass=%s:fontsdir=%s,fade=t=out:st=%.3f:d=0.45[vsub]" % (os.path.join(work, "captions.ass"), FONT_DIR, end - 0.45))
    vout = "[vsub]"
    # Voice: the whole take, once, LEAD seconds in.
    v_in = add_input(voice)
    # Padded with silence to the end of the picture, so the music bed (ducked by this track) runs to the end too.
    fc.append("[%d:a]aformat=channel_layouts=stereo:sample_rates=48000,adelay=%d|%d,apad=whole_dur=%.3f[voice]" % (v_in, int(LEAD * 1000), int(LEAD * 1000), end))
    if has_music:
        m_in = add_input(music)
        fc.append("[voice]asplit[vmain][vduck]")
        fc.append("[%d:a]aformat=channel_layouts=stereo:sample_rates=48000,atrim=duration=%.3f,volume=%.1fdB,afade=t=in:d=1.2,afade=t=out:st=%.3f:d=2.5[bed]"
                  % (m_in, end, args.music_db, end - 2.6))
        fc.append("[bed][vduck]sidechaincompress=threshold=0.1:ratio=2.5:attack=30:release=500:makeup=1[bedd]")
        fc.append("[vmain][bedd]amix=inputs=2:normalize=0,alimiter=limit=0.95[aout]")
    else:
        fc.append("[voice]alimiter=limit=0.95[aout]")
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error"] + inputs + ["-filter_complex", ";".join(fc), "-map", vout, "-map", "[aout]",
           "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart",
           "-t", "%.3f" % end, args.out]
    with open(os.path.join(work, "ffmpeg.txt"), "w") as f:
        f.write(" ".join(cmd))
    subprocess.run(cmd, check=True)
    poster = os.path.splitext(args.out)[0] + "-poster.jpg"
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-ss", "2.4", "-i", args.out, "-frames:v", "1", "-q:v", "3", poster], check=True)
    print("wrote", args.out, "with", os.path.basename(vtt), "and", os.path.basename(poster), "(%.1fs)" % duration(args.out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
