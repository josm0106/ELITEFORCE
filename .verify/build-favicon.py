"""Build the site's Times New Roman E favicon (Windows font source)."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

root = Path(__file__).resolve().parent.parent
font_path = Path('C:/Windows/Fonts/timesbd.ttf')
font = TTFont(font_path)
glyphs = font.getGlyphSet()
name = font.getBestCmap()[ord('E')]
glyph = font['glyf'][name]
pen = SVGPathPen(glyphs)
glyphs[name].draw(pen)
scale = min(34 / (glyph.xMax - glyph.xMin), 40 / (glyph.yMax - glyph.yMin))
tx = 32 - scale * (glyph.xMin + glyph.xMax) / 2
ty = 32 + scale * (glyph.yMin + glyph.yMax) / 2
(root / 'favicon.svg').write_text(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">\n'
    '<title>엘리트 정형외과</title>\n'
    '<rect width="64" height="64" rx="14" fill="#315e4b"/>\n'
    f'<path fill="#fffdf3" transform="translate({tx} {ty}) scale({scale} {-scale})" d="{pen.getCommands()}"/>\n'
    '</svg>\n', encoding='utf-8')

factor = 16
image = Image.new('RGBA', (64 * factor, 64 * factor))
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((0, 0, 64 * factor - 1, 64 * factor - 1), radius=14 * factor, fill='#315e4b')
face = ImageFont.truetype(str(font_path), round(font['head'].unitsPerEm * scale * factor))
left, top, right, bottom = draw.textbbox((0, 0), 'E', font=face)
draw.text(((64 * factor - right - left) / 2, (64 * factor - bottom - top) / 2), 'E', font=face, fill='#fffdf3')
image.resize((48, 48), Image.Resampling.LANCZOS).save(root / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
image.resize((32, 32), Image.Resampling.LANCZOS).save(root / 'favicon-32.png')
image.resize((180, 180), Image.Resampling.LANCZOS).save(root / 'apple-touch-icon.png')
print('Built SVG, ICO (16/32/48), PNG (32), and Apple touch icon (180).')
