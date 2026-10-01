"""Draws the dusk-road banner and writes it inline into index.html (inline so the signs use the page's Overpass font).

    python3 tools/banner.py
"""
import pathlib, random, re
random.seed(7)
W, H, HZ, VX = 1400, 480, 300, 700           # canvas, horizon y, vanishing point x
L0, R0 = 170, 1230                            # road edges at the bottom
def edge(x0, y): return VX + (x0 - VX) * (y - HZ) / (H - HZ)
def depth_y(z): return HZ + (H - HZ) / z      # z=1 at the bottom, grows into the distance

out = []
A = out.append
A(f'<svg class="scene" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMax slice" role="img" aria-label="An empty road at dusk running to the setting sun; a roadside post carries green signs reading JEV ST and JEV BENCHMARKS and a yellow diamond, DECISIONS AHEAD">')
A('''<defs>
<linearGradient id="b-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#060b17"/><stop offset=".32" stop-color="#14254a"/><stop offset=".6" stop-color="#3a4778"/><stop offset=".82" stop-color="#b8645a"/><stop offset="1" stop-color="#f3a35e"/></linearGradient>
<radialGradient id="b-glow" cx=".5" cy="1" r=".6"><stop offset="0" stop-color="#ffd59a" stop-opacity=".95"/><stop offset=".25" stop-color="#ff9f5a" stop-opacity=".55"/><stop offset="1" stop-color="#ff9f5a" stop-opacity="0"/></radialGradient>
<linearGradient id="b-sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff4d6"/><stop offset="1" stop-color="#ffc46b"/></linearGradient>
<linearGradient id="b-ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a1d2c"/><stop offset="1" stop-color="#0b0d14"/></linearGradient>
<linearGradient id="b-road" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a3f45"/><stop offset=".25" stop-color="#2a2b33"/><stop offset="1" stop-color="#1f2026"/></linearGradient>
<linearGradient id="b-sheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb46b" stop-opacity=".45"/><stop offset=".6" stop-color="#ffb46b" stop-opacity="0"/></linearGradient>
<linearGradient id="b-paint" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f4f2" stop-opacity=".25"/><stop offset=".5" stop-color="#f4f4f2" stop-opacity=".85"/></linearGradient>
<linearGradient id="b-pole" x1="0" x2="1"><stop offset="0" stop-color="#5d6170"/><stop offset=".45" stop-color="#b9bcc6"/><stop offset="1" stop-color="#3c3f4a"/></linearGradient>
<linearGradient id="b-green" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16804a"/><stop offset="1" stop-color="#0c5a31"/></linearGradient>
<linearGradient id="b-amber" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd23f"/><stop offset="1" stop-color="#e8b100"/></linearGradient>
<filter id="b-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
<filter id="b-blur" x="-50%" y="-200%" width="200%" height="500%"><feGaussianBlur stdDeviation="3"/></filter>
<filter id="b-shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#000" flood-opacity=".5"/></filter>
</defs>''')
# sky, stars
A(f'<rect width="{W}" height="{HZ+2}" fill="url(#b-sky)"/>')
stars = []
for _ in range(90):
    x, y = random.uniform(0, W), random.uniform(0, 150) ** 1.0
    r = random.choice([.6, .7, .8, 1, 1.2])
    o = round(random.uniform(.25, .8) * (1 - y / 190), 2)
    stars.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r}" opacity="{o}"/>')
A('<g fill="#fff">' + "".join(stars) + '</g>')
# long thin clouds catching the light
for cx, cy, rx, ry, c, o in [(300, 205, 260, 5, "#f6b27a", .35), (1080, 190, 300, 6, "#f6b27a", .3), (560, 150, 220, 4, "#9fb0dc", .22), (1220, 120, 180, 4, "#9fb0dc", .18), (180, 240, 200, 4, "#ffc58a", .35)]:
    A(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="{c}" opacity="{o}" filter="url(#b-blur)"/>')
# sun at the vanishing point
A(f'<ellipse cx="{VX}" cy="{HZ}" rx="620" ry="230" fill="url(#b-glow)"/>')
A(f'<circle cx="{VX}" cy="{HZ-6}" r="44" fill="url(#b-sun)"/>')
A(f'<circle cx="{VX}" cy="{HZ-6}" r="70" fill="#ffd59a" opacity=".35" filter="url(#b-soft)"/>')
# ridges, far to near
def ridge(base, amp, step, seed, fill, op=1):
    random.seed(seed); pts = []; x = -20
    while x <= W + 40:
        pts.append((x, base - random.uniform(0, amp))); x += random.uniform(step * .6, step * 1.4)
    d = f"M-20 {HZ+4} " + " ".join(f"L{x:.0f} {y:.0f}" for x, y in pts) + f" L{W+40} {HZ+4} Z"
    A(f'<path d="{d}" fill="{fill}" opacity="{op}"/>')
ridge(HZ - 8, 46, 70, 3, "#4b4a74", .75)
ridge(HZ - 2, 30, 48, 11, "#2b2d4d", .95)
ridge(HZ + 2, 14, 30, 21, "#191b30")
# ground and road
A(f'<rect y="{HZ}" width="{W}" height="{H-HZ}" fill="url(#b-ground)"/>')
A(f'<path d="M{VX-2} {HZ} L{VX+2} {HZ} L{R0} {H} L{L0} {H} Z" fill="url(#b-road)"/>')
A(f'<path d="M{VX-2} {HZ} L{VX+2} {HZ} L{R0} {H} L{L0} {H} Z" fill="url(#b-sheen)"/>')
# edge lines: thin wedges that widen toward the viewer
for x0, inward in [(L0, 1), (R0, -1)]:
    w = 16 * inward
    A(f'<path d="M{VX} {HZ} L{x0+w*0.15:.1f} {H} L{x0+w:.1f} {H} Z" fill="url(#b-paint)"/>'.replace(f"L{x0+w*0.15:.1f}", f"L{x0+w*0.15:.1f}"))
# centre dashes, spaced by perspective
dashes = []
z = 1.0
while True:
    z1, z2 = z, z * 1.32
    y1, y2 = depth_y(z1), depth_y(z2)
    if y1 - y2 < 1.2: break
    hw1, hw2 = 7 / z1, 7 / z2
    dashes.append(f'<path d="M{VX-hw2:.1f} {y2:.1f} L{VX+hw2:.1f} {y2:.1f} L{VX+hw1:.1f} {y1:.1f} L{VX-hw1:.1f} {y1:.1f} Z"/>')
    z = z2 * 1.32
A('<g fill="#f5c518" opacity=".92">' + "".join(dashes) + '</g>')
# a car far ahead: two tail lights
ty = depth_y(9.5)
A(f'<g transform="translate({VX+6} {ty:.1f})"><rect x="-7" y="-4" width="14" height="5" rx="1.5" fill="#0d0e14"/><circle cx="-5" cy="-1.5" r="1.4" fill="#ff4d4d"/><circle cx="5" cy="-1.5" r="1.4" fill="#ff4d4d"/><ellipse cx="0" cy="-1.5" rx="14" ry="4" fill="#ff4d4d" opacity=".35" filter="url(#b-blur)"/></g>')
# roadside reflector posts on both shoulders
posts = []
for z in [1.15, 1.6, 2.3, 3.4, 5.2, 8]:
    y = depth_y(z); s = 1 / z
    for x0, side in [(L0 - 40, -1), (R0 + 40, 1)]:
        x = edge(x0, y)
        posts.append(f'<rect x="{x-3*s:.1f}" y="{y-34*s:.1f}" width="{6*s:.1f}" height="{34*s:.1f}" fill="#d9d9d9" opacity=".55"/><rect x="{x-3*s:.1f}" y="{y-30*s:.1f}" width="{6*s:.1f}" height="{5*s:.1f}" fill="#ff9a3c"/>')
A('<g>' + "".join(posts) + '</g>')
# speed limit sign on the left shoulder, mid distance
sy = depth_y(3.6); sx = edge(R0 + 90, sy); s = 1 / 3.6 * 1.8
A(f'''<g transform="translate({sx:.0f} {sy:.0f}) scale({s:.2f})" filter="url(#b-shadow)">
<rect x="-4" y="-150" width="8" height="150" fill="url(#b-pole)"/>
<rect x="-46" y="-212" width="92" height="112" rx="8" fill="#f4f4f2"/><rect x="-40" y="-206" width="80" height="100" rx="5" fill="none" stroke="#111" stroke-width="3"/>
<text x="0" y="-182" text-anchor="middle" font-family="Overpass, sans-serif" font-weight="900" font-size="15" fill="#111">SPEED</text>
<text x="0" y="-166" text-anchor="middle" font-family="Overpass, sans-serif" font-weight="900" font-size="15" fill="#111">LIMIT</text>
<text x="0" y="-128" text-anchor="middle" font-family="Overpass, sans-serif" font-weight="900" font-size="30" fill="#111">1×</text>
<text x="0" y="-112" text-anchor="middle" font-family="Overpass Mono, monospace" font-weight="700" font-size="9" letter-spacing="1" fill="#111">FORWARD PASS</text>
</g>''')
# the main signpost, right shoulder
px = 1110
A(f'''<g filter="url(#b-shadow)">
<rect x="{px-7}" y="96" width="14" height="{H-96}" fill="url(#b-pole)"/>
<g transform="translate({px} 108) rotate(-3)">
  <rect x="-170" y="0" width="300" height="74" rx="9" fill="url(#b-green)"/>
  <rect x="-163" y="7" width="286" height="60" rx="6" fill="none" stroke="#f4f4f2" stroke-width="3.5"/>
  <text x="-20" y="51" text-anchor="middle" font-family="Overpass, sans-serif" font-weight="900" font-size="42" letter-spacing="4" fill="#f4f4f2">JEV ST</text>
</g>
<g transform="translate({px} 196) rotate(2)">
  <path d="M-196 0 H96 L132 34 L96 68 H-196 Z" fill="url(#b-green)"/>
  <path d="M-189 7 H93 L122 34 L93 61 H-189 Z" fill="none" stroke="#f4f4f2" stroke-width="3"/>
  <text x="-50" y="44" text-anchor="middle" font-family="Overpass, sans-serif" font-weight="900" font-size="25" letter-spacing="3" fill="#f4f4f2">JEV BENCHMARKS</text>
</g>
<g transform="translate({px} 342) rotate(-1)">
  <rect x="-54" y="-54" width="108" height="108" rx="10" transform="rotate(45)" fill="url(#b-amber)"/>
  <rect x="-47" y="-47" width="94" height="94" rx="6" transform="rotate(45)" fill="none" stroke="#111" stroke-width="3.5"/>
  <text x="0" y="-4" text-anchor="middle" font-family="Overpass, sans-serif" font-weight="900" font-size="15" letter-spacing=".5" fill="#111">DECISIONS</text>
  <text x="0" y="15" text-anchor="middle" font-family="Overpass, sans-serif" font-weight="900" font-size="15" letter-spacing=".5" fill="#111">AHEAD</text>
</g>
</g>''')
A('</svg>')
svg = "\n".join("    " + line for line in out).lstrip()
page = pathlib.Path(__file__).resolve().parent.parent / "index.html"
html = page.read_text()
page.write_text(re.sub(r'<svg class="scene".*?</svg>', lambda m: svg, html, count=1, flags=re.S))
