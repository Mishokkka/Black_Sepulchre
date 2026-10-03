from pathlib import Path
from io import BytesIO
import re, html
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, KeepTogether
from reportlab.pdfgen import canvas
from pypdf import PdfReader, PdfWriter

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/pdf'; OUT.mkdir(parents=True,exist_ok=True)
TMP=ROOT/'tmp/pdfs'; TMP.mkdir(parents=True,exist_ok=True)
for name,file in [('Body','arial.ttf'),('Bold','arialbd.ttf'),('Italic','ariali.ttf')]:
    pdfmetrics.registerFont(TTFont(name,str(Path('C:/Windows/Fonts')/file)))
pdfmetrics.registerFontFamily('Body',normal='Body',bold='Bold',italic='Italic',boldItalic='Bold')
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='TextRU',fontName='Body',fontSize=9.3,leading=13.2,spaceAfter=7,textColor=colors.HexColor('#202B35')))
styles.add(ParagraphStyle(name='H1RU',fontName='Bold',fontSize=21,leading=25,spaceAfter=16,textColor=colors.HexColor('#142F3E')))
styles.add(ParagraphStyle(name='H2RU',fontName='Bold',fontSize=13,leading=17,spaceBefore=12,spaceAfter=8,keepWithNext=True,textColor=colors.HexColor('#142F3E')))
styles.add(ParagraphStyle(name='H3RU',fontName='Bold',fontSize=10.5,leading=14,spaceBefore=10,spaceAfter=6,keepWithNext=True,textColor=colors.HexColor('#245C69')))
styles.add(ParagraphStyle(name='CellRU',fontName='Body',fontSize=8,leading=10.8,spaceAfter=0))
styles.add(ParagraphStyle(name='CellHeadRU',fontName='Bold',fontSize=8,leading=10.8,textColor=colors.white))
styles.add(ParagraphStyle(name='SmallRU',fontName='Body',fontSize=8,leading=11,spaceAfter=6,textColor=colors.HexColor('#5D6971')))

def inline(s):
    s=s.replace('—','-').replace('–','-').replace('\u2011','-')
    s=html.escape(s)
    s=re.sub(r'\*\*(.+?)\*\*',r'<b>\1</b>',s)
    return s

def markdown(path):
    lines=path.read_text(encoding='utf-8').splitlines(); parts=[];i=0
    while i<len(lines):
        line=lines[i].strip()
        if not line: i+=1;continue
        if line.startswith('|'):
            rows=[]
            while i<len(lines) and lines[i].strip().startswith('|'):
                row=[x.strip() for x in lines[i].strip().strip('|').split('|')];i+=1
                if all(re.fullmatch(r'[:\- ]+',x) for x in row):continue
                rows.append(row)
            n=len(rows[0]); width=A4[0]-84
            if n==2: widths=[width*.25,width*.75]
            elif n==3: widths=[width*.085,width*.245,width*.67]
            else: widths=[width*.25,width*.10,width*.17,width*.48]
            cells=[[Paragraph(inline(x),styles['CellHeadRU' if j==0 else 'CellRU']) for x in row] for j,row in enumerate(rows)]
            table=Table(cells,colWidths=widths,repeatRows=1,hAlign='LEFT')
            table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#245C69')),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.HexColor('#F2F6F7'),colors.white]),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6),('LINEBELOW',(0,0),(-1,0),.5,colors.HexColor('#245C69'))]))
            parts.extend([table,Spacer(1,9)]);continue
        if line.startswith('# '):parts.append(Paragraph(inline(line[2:]),styles['H1RU']))
        elif line.startswith('## '):parts.append(Paragraph(inline(line[3:]),styles['H2RU']))
        elif line.startswith('### '):parts.append(Paragraph(inline(line[4:]),styles['H3RU']))
        else:
            paragraph=[line];i+=1
            while i<len(lines) and lines[i].strip() and not lines[i].startswith(('#','|')):
                paragraph.append(lines[i].strip());i+=1
            parts.append(Paragraph(inline(' '.join(paragraph)),styles['TextRU']));continue
        i+=1
    return parts

def footer(c,doc):
    c.saveState();c.setFont('Body',8);c.setFillColor(colors.HexColor('#607581'))
    c.drawString(42,A4[1]-25,'THE BLACK SEPULCHRE | v2.2 | 03.10.2026')
    c.drawRightString(A4[0]-42,24,f'v2.2 / {doc.page}')
    c.restoreState()

story=[Spacer(1,70),Paragraph('THE BLACK<br/>SEPULCHRE',styles['H1RU']),Paragraph('v2.2 - правила кампании',styles['H2RU']),Paragraph('Исправления, 33 миссии и endgame crisis',styles['TextRU']),Spacer(1,30),Paragraph('Нормативная редакция 03.10.2026',styles['TextRU']),Paragraph('Для Deathwatch и Necrons. Сохранены War of Attrition и базовые пределы гарнизонной обороны. Новые правила разработаны для playtest; приложение v2.1 требует отдельного обновления.',styles['TextRU']),Spacer(1,20),Paragraph('Как читать этот единый документ',styles['H2RU']),Paragraph('Сначала применяйте изменения v2.2 и новые карточки миссий. Последний раздел содержит исходный v2.1 для неизменённых правил. Старые нормы, заменённые v2.2, не действуют. Раздел кризиса содержит сюжетные спойлеры; раскрывайте его по фазам.',styles['TextRU']),PageBreak()]
for part,file in [('I / Нормативные изменения','Black_Sepulchre_v2.2_amendments_RU.md'),('II / Все секторные миссии','Black_Sepulchre_v2.2_missions_RU.md'),('III / Кризис и финалы - спойлеры','Black_Sepulchre_v2.2_crisis_RU.md')]:
    story.extend([Paragraph(part,styles['SmallRU'])]+markdown(ROOT/'docs'/file)+[PageBreak()])
story.extend([Paragraph('IV / Неизменённая база v2.1',styles['H1RU']),Paragraph('Далее исходный 54-страничный документ v2.1. Он сохраняет базовый glossary, Season Snapshot, official army-building framework, D66/Salvage, стартовые rosters, Optional STF и остальные неизменённые процедуры.',styles['TextRU']),Paragraph('Печатная нумерация исходника сохранена для ссылок из ревью. Нижняя отметка v2.2 сообщает общий номер страницы сборника. При расхождении используйте нормативные изменения, карточки и конкретные кризисные исключения из первых разделов этой книги.',styles['TextRU'])])
body=TMP/'v22_front.pdf'
doc=SimpleDocTemplate(str(body),pagesize=A4,rightMargin=42,leftMargin=42,topMargin=44,bottomMargin=42,title='The Black Sepulchre v2.2',author='Black Sepulchre campaign')
doc.build(story,onFirstPage=footer,onLaterPages=footer)
front=PdfReader(body)
base=ROOT/'Black_Sepulchre_40k11_Campaign_Rules_v2.1_RU.pdf'
if not base.exists():base=ROOT/'review/source/Black_Sepulchre_40k11_Campaign_Rules_v2.1_RU.pdf'
old=PdfReader(base);writer=PdfWriter()
for page in front.pages:writer.add_page(page)
start=len(front.pages)
for i,page in enumerate(old.pages):
    stamp=BytesIO();c=canvas.Canvas(stamp,pagesize=(float(page.mediabox.width),float(page.mediabox.height)))
    c.setFillColor(colors.white);c.rect(0,0,float(page.mediabox.width),15,fill=1,stroke=0)
    c.setFillColor(colors.HexColor('#607581'));c.setFont('Helvetica',7)
    c.drawString(30,5,'V2.1 BASE - APPLY V2.2 AMENDMENTS')
    c.drawRightString(float(page.mediabox.width)-30,5,f'v2.2 / {start+i+1}');c.save();stamp.seek(0)
    page.merge_page(PdfReader(stamp).pages[0]);writer.add_page(page)
writer.add_outline_item('v2.2 - изменения, миссии и кризис',0)
writer.add_outline_item('Справочная база v2.1 - неизменённые правила',start)
writer.add_metadata({'/Title':'The Black Sepulchre v2.2 - Campaign Rules RU','/Author':'Black Sepulchre campaign','/Subject':'Rules amendments, 33 mission cards, The Last Canticle crisis; inherited v2.1 base'})
writer.compress_identical_objects()
pdf=OUT/'Black_Sepulchre_40k11_Campaign_Rules_v2.2_RU.pdf'
with pdf.open('wb') as f:writer.write(f)
print({'pdf':str(pdf),'front_pages':start,'base_pages':len(old.pages),'total_pages':len(writer.pages),'bytes':pdf.stat().st_size})
