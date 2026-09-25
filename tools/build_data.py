"""Builds the site's data files from the song project.

Inputs (the approved song project, read-only):
  renders/MASTER-song-v1-approved.mp3      the approved song master
  video/analysis/features.json             beat grid and per-frame audio features (30 fps)
  video/analysis/lyrics_timed.json         word timings from the sung audio
  video/pow/chain_full.json                the mined art chain, one block per frame
  video/pow/genesis.json                   the real Bitcoin genesis header and coinbase

Outputs:
  media/song.mp3        byte-identical copy of the master (the chain commits to its SHA-256)
  data/timing.json      beats, sections, lines, words, and audio envelopes
  data/chain.json       compact chain: nonces and hashes; prev links are implied
  data/genesis.json     copy of the verified genesis data
"""
import hashlib
import json
import os
import shutil
import sys

SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/media/projects/history-of-money-song')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.makedirs(os.path.join(ROOT, 'data'), exist_ok=True)
os.makedirs(os.path.join(ROOT, 'media'), exist_ok=True)

song_src = os.path.join(SRC, 'renders/MASTER-song-v1-approved.mp3')
song_dst = os.path.join(ROOT, 'media/song.mp3')
shutil.copyfile(song_src, song_dst)
song_sha = hashlib.sha256(open(song_dst, 'rb').read()).hexdigest()

feat = json.load(open(os.path.join(SRC, 'video/analysis/features.json')))
lines = json.load(open(os.path.join(SRC, 'video/analysis/lyrics_timed.json')))
chain = json.load(open(os.path.join(SRC, 'video/pow/chain_full.json')))
genesis = json.load(open(os.path.join(SRC, 'video/pow/genesis.json')))

assert chain['song_sha256'] == song_sha, 'song copy does not match the chain commitment'


# Corrections to the source word times, checked against two independent Whisper passes and the beat grid.
# Chorus 2's "Stroke of a pen" was squeezed into 82.97-83.13 s in the source alignment; it is sung at about 84.4-86.3 s
# (faster-whisper small.en: 84.50/85.20/85.46/85.70; base.en: 84.06/85.16/85.38/85.60; beat-relative estimate from choruses 1 and 3: 84.38/85.62).
FIXES = [
    # (word, source start, new start, new end)
    ('Stroke', 82.97, 84.40, 85.10),
    ('of', 83.02, 85.18, 85.40),
    ('a', 83.08, 85.42, 85.60),
    ('pen,', 83.13, 85.65, 86.40),
]


def apply_fixes(lines):
    n = 0
    for l in lines:
        for w in l['words']:
            for word, s0, s1, e1 in FIXES:
                if w['t'] == word and abs(w['s'] - s0) < 0.005:
                    w['s'], w['e'] = s1, e1
                    n += 1
        if l['words']:
            l['s'] = min(l['s'], l['words'][0]['s']) if l['words'][0]['s'] < l['s'] else l['words'][0]['s']
    assert n == len(FIXES), f'applied {n} of {len(FIXES)} timing fixes'


apply_fixes(lines)


def r2(a):
    return [round(float(x), 3) for x in a]


timing = {
    'duration': round(chain['t1'], 3),
    'fps': feat['fps'],
    'frames': feat['n'],
    'beats': r2(feat['beats']),
    'sections': r2(feat['sections']),
    'lines': [{'text': l['text'], 's': l['s'], 'e': l['e']} for l in lines],
    'words': [{'t': w['t'], 's': w['s'], 'e': w['e'], 'line': i} for i, l in enumerate(lines) for w in l['words']],
    'env': {k: r2(feat[k]) for k in ('rms', 'onset', 'low', 'perc', 'high')},
}
json.dump(timing, open(os.path.join(ROOT, 'data/timing.json'), 'w'), separators=(',', ':'))

blocks = chain['blocks']
for i, b in enumerate(blocks):
    assert b['i'] == i and b['t_ms'] == round(i / chain['fps'] * 1000)
compact = {
    'bits': chain['bits'],
    'fps': chain['fps'],
    'song_sha256': chain['song_sha256'],
    'genesis': chain['genesis'],
    'total_hashes': chain['total_hashes'],
    'n': len(blocks),
    'nonces': [b['nonce'] for b in blocks],
    'hashes': ''.join(b['hash'] for b in blocks),
}
json.dump(compact, open(os.path.join(ROOT, 'data/chain.json'), 'w'), separators=(',', ':'))
json.dump(genesis, open(os.path.join(ROOT, 'data/genesis.json'), 'w'), indent=1)
print(f"song {song_sha[:16]}... | {len(blocks)} blocks | {len(timing['beats'])} beats | {len(timing['words'])} words")
