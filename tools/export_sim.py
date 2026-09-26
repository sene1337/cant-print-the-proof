"""Exports the Sovereignty simulator from this site into a standalone folder: the darbsllim/sovereignty-simulator
repository, a fork of Bitcoin24 (github.com/bitcoin-model/bitcoin_model). This site stays the source; run this again to
sync the fork after changing js/sim/, the #sim section of index.html or the simulator's CSS.

usage: python3 tools/export_sim.py ../sovereignty-simulator
"""
import os
import re
import shutil
import sys

SRC = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DST = os.path.abspath(sys.argv[1])


def read(rel):
    with open(os.path.join(SRC, rel), encoding='utf-8') as f:
        return f.read()


def write(rel, text):
    path = os.path.join(DST, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)


def copy(src_rel, dst_rel=None):
    dst = os.path.join(DST, dst_rel or src_rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copyfile(os.path.join(SRC, src_rel), dst)


# The simulator's code and data.
copy('js/sim/model.js', 'js/model.js')
copy('js/sim/ui.js', 'js/ui.js')
copy('js/sim/scene.js', 'js/scene.js')
copy('data/sim-glyphs.json')
copy('simulator/index.html', 'reference/v2.html')  # the first versions of the model, kept for the regression test
test = read('tools/test-sim.mjs').replace("'../js/sim/model.js'", "'../js/model.js'").replace("'../simulator/index.html'", "'../reference/v2.html'")
write('tools/test-sim.mjs', test)

# three.js (MIT): the core and the post-processing the scene uses.
for f in ['three.module.js', 'three.core.js', 'LICENSE',
          'addons/postprocessing/EffectComposer.js', 'addons/postprocessing/RenderPass.js', 'addons/postprocessing/UnrealBloomPass.js',
          'addons/postprocessing/OutputPass.js', 'addons/postprocessing/Pass.js', 'addons/postprocessing/ShaderPass.js',
          'addons/postprocessing/MaskPass.js', 'addons/shaders/CopyShader.js', 'addons/shaders/LuminosityHighPassShader.js',
          'addons/shaders/OutputShader.js']:
    copy('vendor/three/' + f)

# Typefaces (SIL Open Font License), only the faces the page uses.
FONTS = [('Cormorant Garamond', 500, 'cormorant-garamond-latin-500-normal'), ('Cormorant Garamond', 600, 'cormorant-garamond-latin-600-normal'),
         ('Figtree', 400, 'figtree-latin-400-normal'), ('Figtree', 500, 'figtree-latin-500-normal'), ('Figtree', 600, 'figtree-latin-600-normal'),
         ('JetBrains Mono', 400, 'jetbrains-mono-latin-400-normal'), ('JetBrains Mono', 500, 'jetbrains-mono-latin-500-normal'),
         ('JetBrains Mono', 700, 'jetbrains-mono-latin-700-normal'), ('Playfair Display', 900, 'playfair-display-latin-900-normal')]
for _, _, name in FONTS:
    copy(f'fonts/{name}.woff2')
for lic in ['cormorant-garamond', 'figtree', 'jetbrains-mono', 'playfair-display']:
    copy(f'fonts/LICENSE-{lic}.txt')

# CSS: the site's tokens and base type, then the simulator's own block as it is.
site = read('css/site.css')
root = re.search(r':root \{.*?\n\}', site, re.S).group(0)
sim = site[site.index('/* The Sovereignty simulator'):]
faces = '\n'.join(f'@font-face {{ font-family: "{fam}"; font-weight: {w}; font-display: swap; src: url(../fonts/{n}.woff2) format("woff2"); }}' for fam, w, n in FONTS)
base = '\n'.join(line for line in site.splitlines() if re.match(
    r'(\* \{|\[hidden\]|html, body|body \{|a \{|a:focus-visible|\.kicker|h2 \{|section p|\.btn \{|\.btn:disabled|\.byline)', line))
foot = """.sim-foot { max-width: 44rem; margin: 0 auto; padding-inline: 16px; padding-block: 8px 48px; font-size: 13px; color: var(--muted); }
.sim-foot p { margin: 0 0 8px; }"""
write('css/sim.css', f"""/* Sovereignty simulator. */
{faces}

/* One dark world: warm paper-white ink, gold for old money, orange for bitcoin. */
{root}
{base}
{foot}

{sim}""")

# The page: the site's #sim section on its own, without the link into the film.
html = read('index.html')
section = html[html.index('<section id="sim"'):html.index('</section>', html.index('<div class="sim-notes">')) + len('</section>')]
section = re.sub(r'\s*<a class="stamp"[^>]*>.*?</a>', '', section, count=1)
icon = html[html.index('<link rel="icon"'):html.index('>', html.index('<link rel="icon"')) + 1]
write('index.html', f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Sovereignty Simulator</title>
<meta name="description" content="Find your freedom year: the first year you could stop working and live on what you own, with bitcoin. Built on Bitcoin24, with taxes, borrowing, STRC and bitcoin's four-year cycle.">
<meta name="theme-color" content="#060504">
<meta name="twitter:card" content="summary">
<meta name="twitter:creator" content="@bradmillscan">
{icon}
<link rel="stylesheet" href="css/sim.css">
<script type="importmap">
{{ "imports": {{ "three": "./vendor/three/three.module.js", "three/addons/": "./vendor/three/addons/" }} }}
</script>
</head>
<body>
<main>
{section}
</main>
<footer class="sim-foot">
  <p>A fork of <a href="https://github.com/bitcoin-model/bitcoin_model">Bitcoin24</a> by Michael Saylor, Shirish Jajodia and Chaitanya Jain; not affiliated with them or with Strategy. Code: MIT licence, for the files this fork adds. three.js: MIT licence. Typefaces: Cormorant Garamond, Figtree, JetBrains Mono and Playfair Display (SIL Open Font License).</p>
</footer>
<script type="module" src="js/ui.js"></script>
</body>
</html>
""")
print('exported to', DST)
