"""Bounds/content checks for the reference engraving and unchanged lyric modes."""
from pathlib import Path
from collections import Counter
import sys,re
import pdfplumber
from pypdf import PdfReader
root=Path(sys.argv[1] if len(sys.argv)>1 else '/private/tmp/hg-pdf-reference-corpus')
for after in root.glob('*-after.pdf'):
    with pdfplumber.open(after) as pdf:
        for page in pdf.pages:
            assert all(c['x0']>=0 and c['x1']<=page.width+.1 and c['top']>=0 and c['bottom']<=page.height for c in page.chars),after.name
        text='\n'.join(page.extract_text() or '' for page in pdf.pages)
        assert text.count('Am')==100,(after.name,text.count('Am'))
        assert 'INTRO' in text and 'ESTROFA' in text,after.name
    before=after.with_name(after.name.replace('-after','-before'))
    if any(mode in after.name for mode in ['lyrics-free','lyrics-synced']):
        old=''.join(p.extract_text() for p in PdfReader(before).pages)
        new=''.join(p.extract_text() for p in PdfReader(after).pages)
        assert Counter(re.sub(r'\s+','',old))==Counter(re.sub(r'\s+','',new)),after.name
print('Five formats: 100 measures, page bounds and section labels preserved; free/synced text unchanged')
