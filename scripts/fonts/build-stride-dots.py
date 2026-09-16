"""Build original display numerals. Requires fontTools and brotli; no source font.

All numerals use a 5x7 square grid, circular dots, and equal x/y spacing.
A short foot on 1 and flat three-dot caps on 0 follow the reference.
"""
from pathlib import Path
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.cu2quPen import Cu2QuPen

# Five columns by seven rows. The pitch is identical in both directions.
PITCH = 100
RADIUS = 46
PATTERNS = {
    '0': ['01110','10001','10001','10001','10001','10001','01110'],
    '1': ['00100','01100','00100','00100','00100','00100','01110'],
    '2': ['01110','10001','00001','00010','00100','01000','11111'],
    '3': ['11110','00001','00001','01110','00001','00001','11110'],
    '4': ['00010','00110','01010','10010','11111','00010','00010'],
    '5': ['11111','10000','10000','11110','00001','00001','11110'],
    '6': ['00110','01000','10000','11110','10001','10001','01110'],
    '7': ['11111','00001','00010','00100','01000','01000','01000'],
    '8': ['01110','10001','10001','01110','10001','10001','01110'],
    '9': ['01110','10001','10001','01111','00001','00010','01100'],
    '.': ['0'] * 6 + ['1'],
    ',': ['0'] * 5 + ['1','1'],
    ':': ['0','1','0','0','0','1','0'],
    '-': ['00000'] * 3 + ['11111'] + ['00000'] * 3,
    '+': ['00000','00100','00100','11111','00100','00100','00000'],
    '/': ['00001','00001','00010','00100','01000','10000','10000'],
    '%': ['11001','11010','00010','00100','01000','01011','10011'],
}


def glyph(rows):
    pen = TTGlyphPen(None)
    curve = Cu2QuPen(pen, max_err=0.5, reverse_direction=False)
    radius, k = RADIUS, 0.5522847498
    for row, cells in enumerate(rows):
        for col, cell in enumerate(cells):
            if cell != '1':
                continue
            x, y = 100 + col * PITCH, 646 - row * PITCH
            r, h = radius, radius * k
            curve.moveTo((x+r, y))
            curve.curveTo((x+r,y-h),(x+h,y-r),(x,y-r))
            curve.curveTo((x-h,y-r),(x-r,y-h),(x-r,y))
            curve.curveTo((x-r,y+h),(x-h,y+r),(x,y+r))
            curve.curveTo((x+h,y+r),(x+r,y+h),(x+r,y))
            curve.closePath()
    return pen.glyph()

fb = FontBuilder(1000, isTTF=True)
names = {c: f'uni{ord(c):04X}' for c in PATTERNS}
fb.setupGlyphOrder(['.notdef','space',*names.values()])
fb.setupCharacterMap({32:'space', **{ord(c):n for c,n in names.items()}})
fb.setupGlyf({'.notdef':glyph([]),'space':glyph([]), **{names[c]:glyph(rows) for c,rows in PATTERNS.items()}})
# True side bearings preserve the grid placement of narrower glyphs such as 1.
metrics = {'.notdef': (600, 0), 'space': (300, 0)}
for c, rows in PATTERNS.items():
    first_col = min(col for row in rows for col, cell in enumerate(row) if cell == '1')
    metrics[names[c]] = ((len(rows[0]) + 1) * PITCH, 100 + first_col * PITCH - RADIUS)
fb.setupHorizontalMetrics(metrics)
fb.setupHorizontalHeader(ascent=850, descent=-150)
fb.setupNameTable({'familyName':'Stride Dots','styleName':'Regular','uniqueFontIdentifier':'Stride Dots Regular 1.3','fullName':'Stride Dots Regular','psName':'StrideDots-Regular','version':'Version 1.3','copyright':'Original numeric glyphs created for Stride, 2026.'})
fb.setupOS2(sTypoAscender=850,sTypoDescender=-150,sTypoLineGap=0,usWinAscent=850,usWinDescent=150,sxHeight=692,sCapHeight=692,usWeightClass=400)
fb.setupPost()
fb.setupMaxp()
fb.font.flavor = 'woff2'
fb.save(Path(__file__).resolve().parents[2] / 'public/fonts/StrideDots-Regular.woff2')
