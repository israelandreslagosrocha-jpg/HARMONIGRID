"""Check generated PDF corpus; requires pypdf and pdfplumber, separate from npm test."""
from pathlib import Path
from collections import Counter
import json, re, sys
from pypdf import PdfReader
import pdfplumber
root = Path(sys.argv[1] if len(sys.argv) > 1 else '/private/tmp/hg-pdf-layout')
rows = []
for after in sorted(root.glob('*-after.pdf')):
    before = after.with_name(after.name.replace('-after', '-before'))
    readers = [PdfReader(before), PdfReader(after)] if before.exists() else [PdfReader(after)]
    texts = [''.join(page.extract_text() for page in reader.pages) for reader in readers]
    def content(text):
        return Counter(re.sub(r'\s+', '', text.replace('H HarmoniGrid by TeoMusicRecords', '')))
    assert content(texts[0]) == content(texts[-1]), f'Content changed: {after.name}'
    assert texts[-1].count('Am') == 100, f'Missing measure chord: {after.name}'
    with pdfplumber.open(after) as pdf:
        for page in pdf.pages:
            assert all(c['x0'] >= 0 and c['x1'] <= page.width + .1 for c in page.chars), f'Horizontal clipping: {after.name}'
            assert all(c['top'] >= 0 and c['bottom'] <= page.height for c in page.chars), f'Vertical clipping: {after.name}'
        first = pdf.pages[0]
        words = first.extract_words()
        title = [w for w in words if w['text'] == 'Una'][0]
        header = [w for w in words if w['text'] == 'Esquema'][0]
        assert title['top'] > header['bottom'], f'Header/title overlap: {after.name}'
    rows.append({'format':after.name.replace('-after.pdf',''),'pagesBefore':len(readers[0].pages) if before.exists() else None,'pagesAfter':len(readers[-1].pages),'chordAmCount':100,'contentCharactersPreserved':True if before.exists() else None,'allTextWithinPage':True,'titleBelowHeader':True})
assert len(rows) == 5
(root/'checks.json').write_text(json.dumps(rows,indent=2))
print('Five PDF formats: content, 100 measures, text bounds and header checks passed')
