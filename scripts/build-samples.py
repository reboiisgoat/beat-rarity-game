"""Build assets/samples for Beat Rarity from CC0 / public-domain sources (cloned blob-less under /tmp/smp)."""
import subprocess, json, re, os, sys, numpy as np
ROOT = "/tmp/smp"; OUT = "/home/claude/beat-rarity-game/assets/samples"
REPO = {"sp": "sonic-pi-samples", "sg": "stargate-sample-pack", "vc": "VCSL", "om": "sampled", "gm": "dgm", "rh": "rhodes"}
CREDIT = {"sp": "Sonic Pi sample library (CC0)", "sg": "Stargate DAW sample pack (CC0)", "vc": "Versilian Community Sample Library (CC0)",
          "om": "oramics/sampled drum machines (public domain)", "gm": "Martin acoustic by Jeff Learman, Discord SFZ GM bank (CC0)",
          "rh": "jRhodes3d by Jeff Learman (CC0)"}
_ls = {}
def ls(src):
    if src not in _ls: _ls[src] = subprocess.run(["git", "-C", f"{ROOT}/{REPO[src]}", "ls-tree", "-r", "--name-only", "HEAD"], capture_output=True, text=True).stdout.splitlines()
    return _ls[src]
def find(src, rx):
    h = [f for f in ls(src) if re.search(rx, f)]
    if not h: raise SystemExit(f"MISS {src} {rx}")
    return sorted(h)[0]
def encode(src, path, dst, secs, kbps=112):
    raw = "/tmp/_raw" + os.path.splitext(path)[1]
    with open(raw, "wb") as fh: subprocess.run(["git", "-C", f"{ROOT}/{REPO[src]}", "show", f"HEAD:{path}"], stdout=fh, check=True)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    fade = max(0.03, min(0.5, secs * 0.18))
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", raw, "-ac", "1", "-ar", "44100",
                    "-af", f"silenceremove=start_periods=1:start_threshold=-48dB,atrim=0:{secs},afade=t=out:st={max(0, secs - fade)}:d={fade}",
                    "-b:a", f"{kbps}k", dst], check=True)
    if os.path.getsize(dst) < 2000:   # a very quiet recording (the triangle): don't let the silence trim eat it
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", raw, "-ac", "1", "-ar", "44100", "-af",
                        f"silenceremove=start_periods=1:start_threshold=-80dB,atrim=0:{secs},afade=t=out:st={max(0, secs - fade)}:d={fade}", "-b:a", f"{kbps}k", dst], check=True)
def pcm(dst):
    b = subprocess.run(["ffmpeg", "-v", "error", "-i", dst, "-f", "f32le", "-ac", "1", "-ar", "22050", "-"], capture_output=True).stdout
    return np.frombuffer(b, np.float32)
def f0(x, sr=22050, lo=25, hi=1500):
    x = x[int(0.05 * sr): int(0.6 * sr)]
    if len(x) < 2048: x = np.pad(x, (0, 2048 - len(x)))
    x = x - x.mean(); n = len(x); X = np.fft.rfft(x, 2 * n); ac = np.fft.irfft(X * np.conj(X))[:n]
    a, b = int(sr / hi), int(sr / lo); lag = a + int(np.argmax(ac[a:b])); return sr / lag
NOTE = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
def midi_of(name):
    m = re.match(r"([A-G])([#b]?)(-?\d)", name); return 12 * (int(m.group(3)) + 1) + NOTE[m.group(1)] + (1 if m.group(2) == "#" else -1 if m.group(2) == "b" else 0)

ONESHOTS = {  # name: (src, regex, seconds)
 "kick_boom": ("sp", r"/bd_boom\.ogg$", 1.4), "kick_fat": ("sp", r"/bd_fat\.ogg$", 1.0), "kick_tek": ("sp", r"/bd_tek\.ogg$", 0.9),
 "kick_punch": ("sg", r"synth-kick-3\.wav$", 0.9), "kick_trap": ("sg", r"kick-drum-1\.wav$", 1.0), "kick_dist": ("sg", r"distkit-kick\.wav$", 0.9),
 "kick_real": ("sg", r"kick_Szpaderski_24_dampened\.wav$", 0.9), "kick_linn": ("om", r"LM-2/samples/kick\.wav$", 0.8), "kick_cr78": ("om", r"CR-78/samples/kick\.wav$", 0.8),
 "snare_dub": ("sp", r"/sn_dub\.ogg$", 0.9), "snare_dolf": ("sp", r"/sn_dolf\.ogg$", 0.9), "snare_wood": ("sg", r"wood-snare-sample-3\.wav$", 0.8),
 "snare_loud": ("sg", r"brian-snare-loud\.wav$", 0.9), "snare_synth": ("sg", r"synthkit-snare\.wav$", 0.8), "snare_real": ("sg", r"snare_Pearl_alumunum_14x8\.wav$", 1.0),
 "snare_linn": ("om", r"LM-2/samples/snare-m\.wav$", 0.8), "rim_808": ("sg", r"fd808a-rimshot\.wav$", 0.5),
 "clap_hiphop": ("sg", r"hip-hop-clap\.wav$", 0.8), "clap_hand": ("sg", r"handclap01\.wav$", 0.8), "clap_group": ("sg", r"synthnisse__claps\.wav$", 0.9),
 "clap_x0x": ("sg", r"x0xproc1-clap\.wav$", 0.8), "clap_real": ("vc", r"Claps/Clap_rr1\.wav$", 0.8), "clap_linn": ("om", r"LM-2/samples/clap\.wav$", 0.8),
 "snap": ("sp", r"/perc_snap\.ogg$", 0.6),
 "hat_zild": ("sp", r"/hat_zild\.ogg$", 0.5), "hat_snap": ("sp", r"/hat_snap\.ogg$", 0.5), "hat_metal": ("sp", r"/hat_metal\.ogg$", 0.5),
 "hat_elec": ("sg", r"electronic-closed-hat-9\.wav$", 0.5), "hat_x0x": ("sg", r"x0xproc1-hatclsd\.wav$", 0.5), "hat_real": ("sg", r"hihat_BRD_tight\.wav$", 0.5),
 "ohat_909": ("sg", r"mini-909ish-open-hat\.wav$", 1.0), "ohat_real": ("sg", r"hihat_BRD_open\.wav$", 1.3), "ohat_linn": ("om", r"LM-2/samples/hihat-open\.wav$", 1.0),
 "ride": ("sg", r"ride_BRD_22\.wav$", 2.2),
 "shaker": ("vc", r"Mid_ShakerDouble_Down_rr1\.wav$", 0.6), "tamb": ("vc", r"Tamb1_Hit_v2_rr1_Mid\.wav$", 0.8), "cowbell": ("vc", r"Cowbell1_Hit_v3_rr1_Mid\.wav$", 0.8),
 "woodblock": ("vc", r"wood_click_f_rr1\.wav$", 0.5), "claves": ("vc", r"Claves1_Hit_v2_rr1_Mid\.wav$", 0.5), "cajon": ("vc", r"Cajon_hit1_f_rr1\.wav$", 0.8),
 "conga": ("vc", r"Conga_HitFM_v2_rr1_Sum\.wav$", 0.8), "bongo": ("vc", r"BongoH_Hit1_v2_rr1_Mid\.wav$", 0.6), "triangle": ("vc", r"Triangle1_HitM_v1_rr2_Mid\.wav$", 1.6),
 "tabla": ("sp", r"/tabla_na\.ogg$", 0.8), "framedrum": ("sg", r"frame_drum_16\.wav$", 1.0), "anvil": ("sg", r"jewelers_anvil\.wav$", 0.8), "guiro": ("om", r"CR-78/samples/guiro-short\.wav$", 0.6),
 # Drop effects
 "vox_check": ("sg", r"Vocal_Check_This_Out\.wav$", 2.0), "vox_insane": ("sg", r"That's_Insane\.wav$", 1.6), "choir": ("sp", r"/ambi_choir\.ogg$", 2.5),
 "scratch": ("sp", r"/vinyl_scratch\.ogg$", 1.5), "backspin": ("sp", r"/vinyl_backspin\.ogg$", 1.6), "rewind": ("sp", r"/vinyl_rewind\.ogg$", 2.5),
 "swoosh": ("sp", r"/perc_swoosh\.ogg$", 1.6), "impact": ("sp", r"/perc_impact1\.ogg$", 1.8), "thunder": ("sg", r"fugue-state-audio/found-sounds/thunder\.wav$", 2.5),
 "zap": ("sg", r"distkit-zap\.wav$", 0.9), "dive": ("sg", r"a-dive1\.wav$", 2.5), "gtr_em9": ("sp", r"/guit_em9\.ogg$", 2.5),
 "gtr_fifths": ("sp", r"/guit_e_fifths\.ogg$", 2.5), "gtr_harm": ("sp", r"/guit_harmonics\.ogg$", 2.5), "gtr_harmA": ("sg", r"guitar-fx/a-harm\.wav$", 2.5),
}
BASS = {"bass_hit": r"/bass_hit_c\.ogg$", "bass_thick": r"/bass_thick_c\.ogg$", "bass_woodsy": r"/bass_woodsy_c\.ogg$",
        "bass_voxy": r"/bass_voxy_c\.ogg$", "bass_drop": r"/bass_drop_c\.ogg$", "bass_dnb": r"/bass_dnb_f\.ogg$"}
BASS_ROOT = {"bass_hit": 24.8, "bass_thick": 36, "bass_woodsy": 36, "bass_voxy": 36, "bass_drop": 36, "bass_dnb": 29}   # checked by spectrum
INST = {  # name: (src, regex with {n} for the note name, notes, seconds)
 "rhodes":  ("rh", r"A_\d+__?{n}_[34]\.m4a$", "A2 D3 G3 B3 D4 F4 B4 E5 A5 D6", 3.2),
 "piano":   ("vc", r"NoSus_Close_{n}_vl3_rr1\.wav$", "C3 E3 G#3 C4 E4 G#4 C5 E5 G#5 C6", 3.2),
 "vibes":   ("vc", r"Vibes_soft_{n}_v2_rr1_Main\.wav$", "F2 A2 C3 E3 G3 B3 D4 F4 A4 C5 E5", 3.2),
 "marimba": ("vc", r"Marimba_hit_Outrigger_{n}_loud_01\.wav$", "G2 F3 C4 G4 B4 F5 C6", 2.0),
 "glock":   ("vc", r"glock_loud_{n}_01\.wav$", "G4 C5 G5 C6 G#6 C7", 2.4),
 "kalimba": ("vc", r"MainSpirit_{n}_k\d+_vl3_rr2\.wav$", "B2 C#3 D#3 F#3 G#3 B3 C#4 D#4 F#4 A4 B4", 2.6),
 "chimes":  ("vc", r"TB_hit_{n}_v4_\d\.wav$", "C4 E4 G4 B4 D5 F5", 3.2),
 "harp":    ("vc", r"KSHarp_{n}_mf1\.wav$", "A2 E3 G3 B3 D4 F4 A4 C5 E5 G5 D6", 3.0),
 "sax":     ("vc", r"BrettTenor_Vib_Main_{n}_var\d\.wav$", "C3 E3 F#3 A#3 C4 E4 G4 A#4 C5 D5", 2.6),
 "harmonica": ("vc", r"Special20-C/Sustains/Normal/Hohner-Special20_Normal_{n}\.wav$", "C3 E3 C4 E4 G4 C5 E5 G5 C6", 2.6),
 "ocarina": ("vc", r"StdOcarina_SusVib_{n}\.wav$", "A3 C4 E4 F#4 A4 C5", 2.4),
 "martin":  ("gm", r"MartinGM2_\d+_+{n}_1\.wav$", "Bb2 Db3 E3 G3 Bb3 Db4 E4 Ab4 B4 D5 F5 Ab5 B5", 3.2),
}
man = {"oneshots": {}, "bass": {}, "inst": {}}; credits = set(); warn = []
for name, (src, rx, secs) in ONESHOTS.items():
    encode(src, find(src, rx), f"{OUT}/{name}.mp3", secs); man["oneshots"][name] = 1; credits.add(src)
for name, rx in BASS.items():
    dst = f"{OUT}/{name}.mp3"; encode("sp", find("sp", rx), dst, 2.2)
    f = f0(pcm(dst), lo=25, hi=400); m = round(69 + 12 * np.log2(f / 440), 1); man["bass"][name] = BASS_ROOT.get(name, m); credits.add("sp")
    print(f"{name}: {f:.1f} Hz -> midi {m}")
OFF = {'vibes': 12, 'marimba': 12, 'glock': 12, 'kalimba': 12, 'chimes': 12, 'sax': 12, 'harmonica': 12, 'ocarina': 12}   # these libraries name notes an octave low (C3 = middle C); measured from their spectra
for name, (src, rx, notes, secs) in INST.items():
    man["inst"][name] = []
    for n in notes.split():
        m = midi_of(n) + OFF.get(name, 0)
        dst = f"{OUT}/{name}/{m}.mp3"; encode(src, find(src, rx.replace("{n}", re.escape(n))), dst, secs)
        f = f0(pcm(dst), lo=50, hi=2200); dm = 69 + 12 * np.log2(f / 440)
        off = (dm - m + 6) % 12 - 6
        if abs(off) > 0.6: warn.append(f"{name} {n}: detected {dm:.2f} vs {m}")
        man["inst"][name].append(m)
    credits.add(src)
json.dump(man, open(f"{OUT}/manifest.json", "w"), indent=1)
open(f"{OUT}/CREDITS.txt", "w").write("Samples in this folder are CC0 / public domain. No attribution is required; credited here as thanks.\n\n" + "\n".join(CREDIT[c] for c in sorted(credits)) + "\n")
print("\n".join(warn) or "pitch check ok")
