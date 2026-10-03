from pathlib import Path
import json
import pypdfium2 as pdfium
import pdfplumber
from PIL import Image, ImageOps, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
path=ROOT/'output/pdf/Black_Sepulchre_40k11_Campaign_Rules_v2.2_RU.pdf'
out=ROOT/'tmp/pdfs/qa';out.mkdir(parents=True,exist_ok=True)
doc=pdfium.PdfDocument(path)
indices=list(range(23))+[23,76]
for i in indices:
    page=doc[i];bitmap=page.render(scale=1.3);im=bitmap.to_pil();im.save(out/f'page_{i+1:02}.png');bitmap.close();page.close()
for start in range(0,len(indices),6):
    grid=Image.new('RGB',(1050,1020),'#CED8DE');draw=ImageDraw.Draw(grid)
    for slot,i in enumerate(indices[start:start+6]):
        im=Image.open(out/f'page_{i+1:02}.png').convert('RGB');im.thumbnail((335,475))
        x=(slot%3)*350+7;y=(slot//3)*510+20
        grid.paste(im,(x,y));draw.text((x,y-15),f'page {i+1}',fill='black')
    grid.save(out/f'contact_{start//6+1}.png')
bad=[];chapters=[]
with pdfplumber.open(path) as pdf:
    for i,page in enumerate(pdf.pages[:23]):
        chars=[c for c in page.chars if c['text'].strip() and c['top']>40 and c['bottom']<page.height-38]
        for c in chars:
            if c['x0']<41 or c['x1']>page.width-41:bad.append((i+1,c['text'],c['x0'],c['x1']))
        t=page.extract_text() or ''
        if '\ufffd' in t:bad.append((i+1,'replacement glyph'))
        chapters.append({'page':i+1,'start':t.splitlines()[1:4]})
assert not bad,bad[:10]
(out/'qa.json').write_text(json.dumps({'pages':len(doc),'rendered':len(indices),'body_out_of_margin':bad,'chapters':chapters},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'pages':len(doc),'rendered':len(indices),'body_out_of_margin':len(bad),'qa_dir':str(out),'chapters':chapters},ensure_ascii=False,indent=2))
