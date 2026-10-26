"""Refresh all named stars from the IAU catalogue, supplementing absent coordinates.
Run from the repository root: python3 scripts/build_catalogue.py
Uses only Python's standard library. Review catalogue changes before committing.
"""
import csv, json, unicodedata
from pathlib import Path
from urllib.request import urlopen
from html.parser import HTMLParser
import io
class TableParser(HTMLParser):
 def __init__(self): super().__init__(); self.rows=[]; self.row=None; self.cell=None
 def handle_starttag(self,tag,attrs):
  if tag=='tr': self.row=[]
  if tag in ('td','th'): self.cell=''
 def handle_data(self,data):
  if self.cell is not None: self.cell+=data
 def handle_endtag(self,tag):
  if tag in ('td','th') and self.cell is not None:
   if self.row is not None: self.row.append(self.cell.strip())
   self.cell=None
  if tag=='tr' and self.row is not None: self.rows.append(self.row); self.row=None
parser=TableParser()
parser.feed(urlopen('https://exopla.net/star-names/modern-iau-star-names/',timeout=60).read().decode())
supplement_csv=urlopen('https://raw.githubusercontent.com/cyschneck/iau-star-names/main/stars_with_data.csv',timeout=60).read().decode()
normalize=lambda s: unicodedata.normalize('NFC',s).lower()
supplement={normalize(x['Common Name']):x for x in csv.DictReader(io.StringIO(supplement_csv))}
rows=[x for x in parser.rows if len(x)==17 and x[0]!='proper names']
def ra(s):
 h,m,sec=s.split('.'); return (int(h)+int(m)/60+float(sec[:2]+'.'+sec[2:])/3600)*15
def dec(s):
 sign=-1 if s.startswith('-') else 1
 d,ms=s.lstrip('-+').split('.');ms=ms.ljust(4,'0')
 return sign*(int(d)+int(ms[:2])/60+float(ms[2:4]+'.'+ms[4:])/3600)
stars=[]
for r in rows:
 extra=supplement.get(normalize(r[0]))
 fallback=not r[13] or not r[14]
 a=ra(extra['Right Ascension (HH.MM.SS)']) if fallback else float(r[13])
 d=dec(extra['Declination (DD.SS)']) if fallback else float(r[14])
 try: mag=float(r[15]) if r[15] else float(extra['Magnitude (V, Visual)'])
 except (ValueError, TypeError): mag=None
 stars.append(dict(id=r[0],name=r[0],ra=a,dec=d,mag=mag,constellation=r[6],designation=r[2],aliases=[r[5]] if r[5] and r[5]!=r[0] else [],coordinateSource='supplement' if fallback else 'IAU'))
assert len(stars)==len({s['id'] for s in stars})
assert all(0<=s['ra']<360 and -90<=s['dec']<=90 for s in stars)
Path('public/data/stars.json').write_text(json.dumps(stars,ensure_ascii=False,separators=(',',':')))
print(f'Built {len(stars)} stars; {sum(s["coordinateSource"]=="supplement" for s in stars)} supplemented coordinates.')
