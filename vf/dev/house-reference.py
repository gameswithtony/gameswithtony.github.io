from pathlib import Path
import sys
root = Path(__file__).resolve().parents[1] / 'resources'
sys.path.insert(0, str(root / 'python'))
import pymupdf
files = sorted((root / 'reference-images').glob('*boardsREL120house*jpg.jpg'))
doc = pymupdf.open()
page = doc.new_page(width=1400, height=520)
for i, file in enumerate(files):
    x, y = i % 7 * 200, i // 7 * 260
    page.insert_text((x + 10, y + 20), file.name.split('house')[-1].split('jpg')[0], fontsize=14)
    source = pymupdf.open(file)
    p = source[0]
    crop = p.get_pixmap(clip=pymupdf.Rect(p.rect.width*.90, p.rect.height*.64, p.rect.width*.995, p.rect.height*.80), matrix=pymupdf.Matrix(2,2))
    page.insert_image(pymupdf.Rect(x+10,y+30,x+190,y+250), pixmap=crop)
page.get_pixmap().save(root/'house-sigils-reference.png')
print(f'{len(files)} House emblems rendered')
