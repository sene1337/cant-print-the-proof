"""Extracts glyph outlines from an open-licensed font, so the site can extrude solid 3D text without a font loader.

data/glyphs.json: the film's digits and punctuation, in the font's default old-style figures.
data/sim-glyphs.json: the simulator's years in lining figures (all the same height), plus the letters of NOT YET.

Font: Playfair Display Black (SIL Open Font License), from @fontsource/playfair-display.
"""
import json
import os

from fontTools.pens.basePen import BasePen
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'node_modules/@fontsource/playfair-display/files/playfair-display-latin-900-normal.woff')
FILES = {'glyphs.json': ('0123456789,.', False), 'sim-glyphs.json': ('0123456789NOTYE ', True)}


class Rec(BasePen):
    def __init__(self, gs):
        super().__init__(gs)
        self.cmds = []

    def _moveTo(self, p):
        self.cmds.append(['M', p[0], p[1]])

    def _lineTo(self, p):
        self.cmds.append(['L', p[0], p[1]])

    def _curveToOne(self, a, b, c):
        self.cmds.append(['C', a[0], a[1], b[0], b[1], c[0], c[1]])

    def _qCurveToOne(self, a, b):
        self.cmds.append(['Q', a[0], a[1], b[0], b[1]])

    def _closePath(self):
        self.cmds.append(['Z'])

    def _endPath(self):
        self.cmds.append(['Z'])


font = TTFont(SRC)
cmap = font.getBestCmap()
gs = font.getGlyphSet()
hmtx = font['hmtx']
for file, (chars, lining) in FILES.items():
    out = {'unitsPerEm': font['head'].unitsPerEm, 'glyphs': {}}
    for ch in chars:
        name = cmap[ord(ch)]
        if lining and ch.isdigit():
            name += '.lf'  # the font's lnum alternates
        pen = Rec(gs)
        gs[name].draw(pen)
        out['glyphs'][ch] = {'advance': hmtx[name][0], 'cmds': pen.cmds}
    json.dump(out, open(os.path.join(ROOT, 'data', file), 'w'), separators=(',', ':'))
    print(file, len(out['glyphs']), 'glyphs, upm', out['unitsPerEm'])
