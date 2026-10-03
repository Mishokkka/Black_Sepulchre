from pathlib import Path
import json
import pdfplumber
import pypdfium2 as pdfium
from PIL import Image, ImageOps, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
PDF=ROOT/'output/pdf/Black_Sepulchre_40k11_Campaign_Rules_v2.2.1_RU.pdf'
OUT=ROOT/'tmp/pdfs/v221';OUT.mkdir(parents=True,exist_ok=True)
rows=[];violations=[]
with pdfplumber.open(PDF) as doc:
    for i,p in enumerate(doc.pages,1):
        text=p.extract_text() or ''
        content=[c for c in p.chars if c['top']>35 and c['bottom']<p.height-35]
        bad=[c for c in content if c['x0']<38 or c['x1']>p.width-38]
        if bad:violations.append({'page':i,'count':len(bad),'sample':''.join(c['text'] for c in bad)[:100]})
        lines=text.splitlines()
        rows.append({'page':i,'chars':len(text),'start':' / '.join(lines[1:3]),'end':' / '.join(lines[-4:-1]),'bottom':round(max((c['bottom'] for c in content),default=0),1)})
pdf=pdfium.PdfDocument(str(PDF))
for i in range(len(pdf)):
    image=pdf[i].render(scale=1.35).to_pil().convert('RGB')
    image.save(OUT/f'page_{i+1:02}.png')
for start in range(0,len(pdf),6):
    canvas=Image.new('RGB',(1240,1730),'#cbd5db');draw=ImageDraw.Draw(canvas)
    for offset in range(6):
        p=start+offset
        if p>=len(pdf):break
        im=Image.open(OUT/f'page_{p+1:02}.png');im.thumbnail((594,535))
        x=16+(offset%2)*615;y=26+(offset//2)*566
        canvas.paste(im,(x,y));draw.text((x,y-18),str(p+1),fill='black')
    canvas.save(OUT/f'contact_{start//6+1:02}.png')
(OUT/'qa.json').write_text(json.dumps({'pages':rows,'margin_violations':violations},ensure_ascii=False,indent=2),encoding='utf-8')
short_pages=[r for r in rows if r['chars']<700]
print(json.dumps({'page_count':len(rows),'short_pages':short_pages,'margin_violations':violations},ensure_ascii=False))
assert not violations, 'Text outside margins'
assert not short_pages, 'Unexpected short spillover page'
