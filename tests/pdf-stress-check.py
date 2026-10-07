"""Checks actual stress PDFs, independent of renderer diagnostics. Needs bundled Python."""
from pathlib import Path
from collections import Counter
import json,re,sys
import pdfplumber
from reportlab.pdfbase.pdfmetrics import stringWidth
root=Path(sys.argv[1] if len(sys.argv)>1 else 'output/pdf/pruebas-irregulares')
formats=['chords-only','chords-only-expanded','chords-and-lyrics-free','chords-and-lyrics-rhythm','chords-and-lyrics-synced']
summary=[]
for name in formats:
    with pdfplumber.open(root/(name+'.pdf')) as pdf:
        text='\n'.join(page.extract_text() or '' for page in pdf.pages)
        for case in range(1,15):
            assert f'CASO {case}:' in text,(name,case,'Missing source case')
        for name6 in ['G6/9','Ebm6/9']:
            assert name6 in text,(name,name6,'Slash chord quality lost')
        for bass in ['/E','/A#','/Db','/C','/B','/Gb']:
            assert bass in text,(name,bass,'Slash bass lost')
        for page in pdf.pages:
            assert all(c['x0']>=0 and c['x1']<=page.width+.1 and c['top']>=0 and c['bottom']<=page.height for c in page.chars),(name,'Text outside page')
        if name=='chords-only-expanded':
            assert text.count('CASO 1:')==2 and text.count('CASO 9:')==2,(name,'Simple/ending repeat materialization lost')
        else:
            assert all(text.count(f'CASO {case}:')==1 for case in range(1,15)),(name,'Compact source duplicated')
        summary.append({'format':name,'pages':len(pdf.pages),'sourceCases':14,'pageBounds':True,'complexQualityAndBass':True})
trace=json.loads((root/'alignment.json').read_text())
for voice in trace['lyrics']:
    harmonic=next(h for h in trace['harmony'] if h['index']==voice['index'])
    scale=harmonic['timeline']['scale']
    assert scale>=.75,('Overly small lyric text',voice['index'],scale)
    # Ensure every adjacent printed syllable has a visible gap; compare actual
    # shared-map positions with PDF Helvetica character widths, in millimetres.
    syllables=[e for e in voice['events'] if not e['rest'] and e.get('syllable') and e['syllable']['text']!='~']
    for a,b in zip(syllables,syllables[1:]):
        assert b['x']>a['x'],('Reversed syllable order',voice['index'])
        half_widths=sum(stringWidth(e['syllable']['text'],'Helvetica',8*scale)*25.4/72/2 for e in [a,b])
        assert b['x']-a['x']-half_widths>.7,('Syllable collision',voice['index'],a['syllable']['text'],b['syllable']['text'])
assert len(trace['ties'])>=6
(root/'pdf-checks.json').write_text(json.dumps(summary,indent=2))
print('Five formats: 14 source cases each, complex qualities and bass preserved, repeats expanded, text within pages and tie paths present')
