from pathlib import Path
import html, re, json
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, PageBreak, Table, TableStyle, KeepTogether
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.graphics.shapes import Drawing, Line, Circle, String, Rect

ROOT=Path(__file__).resolve().parents[1]
OUTPUT=ROOT/'output/pdf/Black_Sepulchre_40k11_Campaign_Rules_v2.2.1_RU.pdf'
TMP=ROOT/'tmp/pdfs/v221'; TMP.mkdir(parents=True,exist_ok=True)
WIDTH,HEIGHT=A4
M=39
CONTENT=WIDTH-2*M
INK=colors.HexColor('#20303B'); TEAL=colors.HexColor('#15586A'); GRAY=colors.HexColor('#61737E')
for name,file in [('RU','arial.ttf'),('RUB','arialbd.ttf'),('RUI','ariali.ttf'),('RUBI','arialbi.ttf')]:
    pdfmetrics.registerFont(TTFont(name,str(Path('C:/Windows/Fonts')/file)))
pdfmetrics.registerFontFamily('RU',normal='RU',bold='RUB',italic='RUI',boldItalic='RUBI')
S={
 'body':ParagraphStyle('body',fontName='RU',fontSize=9.5,leading=12.4,spaceAfter=6,textColor=INK),
 'h1':ParagraphStyle('h1',fontName='RUB',fontSize=20,leading=23.5,spaceAfter=12,textColor=TEAL,keepWithNext=True),
 'h2':ParagraphStyle('h2',fontName='RUB',fontSize=11.4,leading=14,spaceBefore=7,spaceAfter=5,textColor=TEAL,keepWithNext=True),
 'cell':ParagraphStyle('cell',fontName='RU',fontSize=8.8,leading=11.2,textColor=INK),
 'head':ParagraphStyle('head',fontName='RUB',fontSize=8.5,leading=10.8,textColor=colors.white),
 'toc':ParagraphStyle('toc',fontName='RU',fontSize=10,leading=15,spaceBefore=0,spaceAfter=0,textColor=INK),
}
def inline(t):
    t=html.escape(t)
    t=re.sub(r'\*\*(.+?)\*\*',r'<b>\1</b>',t)
    t=re.sub(r'\[([^\]]+)\]\((https?://[^)]+)\)',r'<link href="\2" color="#15586A">\1</link>',t)
    return t

def map_drawing():
    d=Drawing(CONTENT,135)
    points={'A':(32,65),'B':(115,105),'C':(115,25),'D':(205,105),'E':(205,25),'G':(CONTENT/2,65),'F':(312,105),'H':(312,25),'I':(402,105),'J':(402,25),'K':(485,65)}
    edges=['AB','AC','BD','CE','DF','EH','DG','EG','FG','HG','FI','HJ','IK','JK']
    for edge in edges:
        a,b=map(points.get,edge);d.add(Line(*a,*b,strokeColor=colors.HexColor('#BCCAD0'),strokeWidth=1.5))
    for k,(x,y) in points.items():
        c=colors.HexColor('#31596F') if k in 'ABCDE' else colors.HexColor('#397264') if k!='G' else colors.HexColor('#8D6E48')
        d.add(Circle(x,y,13,fillColor=c,strokeColor=None))
        d.add(String(x,y-4,k,textAnchor='middle',fontName='RUB',fontSize=11,fillColor=colors.white))
    return d

def layouts_drawing():
    d=Drawing(CONTENT,195)
    patterns={
      'THREE':[(.25,.5),(.5,.5),(.75,.5)],
      'FOUR':[(x,y) for x in [.3,.7] for y in [.35,.65]],
      'FIVE':[(x,y) for x in [.3,.7] for y in [.35,.65]]+[(.5,.5)],
      'CROSS':[(.5,.5),(.25,.5),(.75,.5),(.5,.1),(.5,.9)],
      'TRIANGLE':[(.5,.35),(.3,.65),(.7,.65)],
      'FINAL':[(.2,.7),(.4,.7),(.6,.7),(.8,.7),(.5,.9)]}
    for i,(label,points) in enumerate(patterns.items()):
        x0=6+(i%3)*172;y0=112-(i//3)*94;w=150;h=66
        d.add(Rect(x0,y0,w,h,strokeColor=colors.HexColor('#9CB0BA'),fillColor=colors.white))
        for y in [y0,y0+h-12]:d.add(Rect(x0,y,w,12,strokeColor=None,fillColor=colors.HexColor('#E7EEF0')))
        for x,y in points:d.add(Circle(x0+x*w,y0+y*h,3.3,fillColor=TEAL,strokeColor=None))
        d.add(String(x0+w/2,y0-13,label,fontName='RUB',fontSize=8,textAnchor='middle',fillColor=INK))
    return d

def widths(headers):
    n=len(headers)
    if n==5:return [CONTENT*x for x in [.15,.22,.25,.24,.14]]
    if n==3:
        if 'CR' in headers:return [CONTENT*x for x in [.29,.15,.56]]
        if headers[0].startswith('Сектор'):return [CONTENT*x for x in [.23,.44,.33]]
        if headers[0]=='Сторона':return [CONTENT*x for x in [.16,.42,.42]]
        return [CONTENT*x for x in [.13,.2,.67]]
    if n==2:return [CONTENT*.30,CONTENT*.70]
    return [CONTENT/n]*n

def table(rows,compact=False):
    tb=Table([[Paragraph(inline(c),S['head' if i==0 else 'cell']) for c in row] for i,row in enumerate(rows)],colWidths=widths(rows[0]),repeatRows=1,hAlign='LEFT')
    tb.setStyle(TableStyle([
      ('BACKGROUND',(0,0),(-1,0),TEAL),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.HexColor('#F0F4F5'),colors.white]),
      ('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),6),('RIGHTPADDING',(0,0),(-1,-1),6),
      ('TOPPADDING',(0,0),(-1,-1),1 if compact else 4),('BOTTOMPADDING',(0,0),(-1,-1),1 if compact else 4),
      ('LINEBELOW',(0,0),(-1,0),.5,TEAL)]))
    return tb

class Book(BaseDocTemplate):
    def __init__(self,*a,**kw):
        super().__init__(*a,**kw)
        self.section_pages=[];self.last_heading='';self.heading_no=0
    def beforeDocument(self):
        self.section_pages=[];self.last_heading='';self.heading_no=0
    def afterFlowable(self,f):
        if isinstance(f,Paragraph) and f.style.name=='h1' and getattr(f,'nav',True):
            self.heading_no+=1;k=f'section-{self.heading_no}';title=f.getPlainText()
            self.canv.bookmarkPage(k);self.canv.addOutlineEntry(title,k,0,False)
            self.notify('TOCEntry',(0,title,self.page,k))
            self.section_pages.append({'title':title,'page':self.page,'key':k})
            self.last_heading=title
        elif isinstance(f,Paragraph) and f.style.name=='h2' and re.match(r'^[A-K][1-3]\.', f.getPlainText()):
            title=f.getPlainText();key='mission-'+title[:2]
            self.canv.bookmarkPage(key);self.canv.addOutlineEntry(title,key,1,False)

def page(c,doc):
    c.saveState();c.setFillColor(TEAL);c.rect(0,HEIGHT-9,WIDTH,9,stroke=0,fill=1)
    c.setFont('RU',8);c.setFillColor(GRAY)
    c.drawString(M,HEIGHT-27,'THE BLACK SEPULCHRE  /  2.2.1')
    c.drawRightString(WIDTH-M,HEIGHT-27,'ЕДИНЫЙ СВОД  ·  03.10.2026')
    c.setStrokeColor(colors.HexColor('#CFD9DD'));c.line(M,32,WIDTH-M,32)
    c.setFont('RU',7.5);c.drawString(M,20,'CAMPAIGN REFERENCE  /  Deathwatch & Necrons')
    c.drawRightString(WIDTH-M,20,str(doc.page));c.restoreState()

def story_from_source():
    src=(ROOT/'docs/Black_Sepulchre_v2.2.1_rules_RU.md').read_text(encoding='utf-8').splitlines()
    story=[];i=0;sections=0;section_name=''
    while i<len(src):
        line=src[i].strip()
        if not line:i+=1;continue
        if line.startswith('# '):
            if sections:
                joined=line[2:].startswith(('C ·','E ·','G ·','I ·'))
                story.append(Spacer(1,13) if joined else PageBreak())
                if sections==1:
                    h=Paragraph('Навигация',S['h1']);h.nav=False;story.append(h)
                    story.append(Paragraph('Нажмите название раздела или используйте закладки PDF. Карточки A/K попарно идентичны; остальные сектора содержат по три миссии.',S['body']))
                    toc=TableOfContents();toc.levelStyles=[S['toc']];toc.dotsMinLevel=0
                    toc.tableStyle=TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),0),('RIGHTPADDING',(0,0),(-1,-1),0),('TOPPADDING',(0,0),(-1,-1),1),('BOTTOMPADDING',(0,0),(-1,-1),1)])
                    story.extend([toc,PageBreak()])
            section_name=line[2:]
            story.append(Paragraph(inline(section_name),S['h1']));sections+=1;i+=1;continue
        if line.startswith('## '):story.append(Paragraph(inline(line[3:]),S['h2']));i+=1;continue
        if line=='@MAP':story.extend([map_drawing(),Spacer(1,7)]);i+=1;continue
        if line=='@LAYOUTS':story.extend([layouts_drawing(),Spacer(1,7)]);i+=1;continue
        if line.startswith('|'):
            rows=[]
            while i<len(src) and src[i].startswith('|'):
                row=[v.strip() for v in src[i].strip('|').split('|')];i+=1
                if all(re.fullmatch(r'[-: ]+',v) for v in row):continue
                rows.append(row)
            story.extend([table(rows,compact=section_name=='Battle Honours' or 'D66' in section_name),Spacer(1,7)]);continue
        paragraph=[line];i+=1
        while i<len(src) and src[i].strip() and not src[i].startswith(('#','|','@')):
            paragraph.append(src[i].strip());i+=1
        story.append(Paragraph(inline(' '.join(paragraph)),S['body']))
    return story

if __name__=='__main__':
    OUTPUT.parent.mkdir(parents=True,exist_ok=True)
    doc=Book(str(OUTPUT),pagesize=A4,leftMargin=M,rightMargin=M,topMargin=44,bottomMargin=43,title='The Black Sepulchre 2.2.1 - Единый свод правил',author='Black Sepulchre campaign',subject='Автоматизация кампании, 33 миссии, Последний такт',pageCompression=1)
    doc.addPageTemplates(PageTemplate(id='normal',frames=[Frame(M,43,CONTENT,HEIGHT-87,leftPadding=0,bottomPadding=0,rightPadding=0,topPadding=0)],onPage=page))
    doc.multiBuild(story_from_source())
    (TMP/'navigation.json').write_text(json.dumps(doc.section_pages,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'pdf':str(OUTPUT),'pages':doc.page,'sections':len(doc.section_pages),'bytes':OUTPUT.stat().st_size},ensure_ascii=False))
