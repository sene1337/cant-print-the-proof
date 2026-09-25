"""Independent check of the art chain, with nothing but Python's standard library.

Checks:
  1. Bitcoin's real genesis block header hashes to 000000000019d6...8ce26f, and its coinbase carries the Times headline.
  2. media/song.mp3 hashes to the SHA-256 that every block commits to.
  3. Every frame block's 80-byte header (prev hash | song hash | frame index | time in ms | nonce) double-SHA-256s
     to the stored hash, the hash is below the 18-bit target, and each block points to the one before.
     Block 0 points to Bitcoin's genesis block.

Run from the repository root:  python3 tools/verify.py
"""
import hashlib
import json
import os
import struct
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
d = lambda b: hashlib.sha256(hashlib.sha256(b).digest()).digest()

# 1. Bitcoin's genesis block, rebuilt from its published fields.
merkle = bytes.fromhex('4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b')[::-1]
header = struct.pack('<I', 1) + bytes(32) + merkle + struct.pack('<III', 1231006505, 0x1d00ffff, 2083236893)
genesis = d(header)[::-1].hex()
assert genesis == '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f', genesis
coinbase = bytes.fromhex('04ffff001d0104455468652054696d65732030332f4a616e2f32303039204368616e63656c6c6f72206f6e206272696e6b206f66207365636f6e64206261696c6f757420666f722062616e6b73')
headline = coinbase[8:].decode()
assert headline == 'The Times 03/Jan/2009 Chancellor on brink of second bailout for banks'
print(f'genesis block    {genesis}  ok')
print(f'coinbase text    "{headline}"  ok')

# 2. The song.
C = json.load(open(os.path.join(ROOT, 'data/chain.json')))
song = hashlib.sha256(open(os.path.join(ROOT, 'media/song.mp3'), 'rb').read()).hexdigest()
assert song == C['song_sha256'], 'media/song.mp3 does not match the committed song hash'
print(f'song sha-256     {song}  ok')

# 3. The frame chain.
assert C['genesis'] == genesis
target = 1 << (256 - C['bits'])
prev = bytes.fromhex(C['genesis'])
songb = bytes.fromhex(song)
total = 0
for i in range(C['n']):
    t_ms = round(i / C['fps'] * 1000)
    nonce = C['nonces'][i]
    h = d(prev + songb + struct.pack('<IIQ', i, t_ms, nonce))
    stored = C['hashes'][i * 64:(i + 1) * 64]
    if h.hex() != stored or int.from_bytes(h, 'big') >= target:
        sys.exit(f'block {i} FAILED')
    total += nonce + 1
    prev = h
assert total == C['total_hashes']
print(f"frame blocks     {C['n']:,} blocks at {C['bits']} zero bits, each linked to the one before  ok")
print(f'work             {total:,} SHA-256d attempts')
