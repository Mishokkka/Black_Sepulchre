"""Assemble a standalone source without importing legacy rules."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
DOC = ROOT / 'docs'
if __name__ == '__main__':
    parts = [(DOC/f'Black_Sepulchre_v2.2.1_{part}_RU.md').read_text(encoding='utf-8')
             for part in ['core', 'missions', 'crisis', 'reference']]
    text = '\n\n'.join(parts)
    text = text.replace('—','-').replace('–','-').replace('\u2011','-').replace('\u00a0',' ')
    (DOC/'Black_Sepulchre_v2.2.1_rules_RU.md').write_text(text, encoding='utf-8')
    print({'words':len(text.split()),'characters':len(text),'sections':len(re.findall(r'^# ',text,re.M))})
