#!/usr/bin/env python3
from __future__ import annotations
import csv, io, json, os, re, tempfile, time, zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
import requests

START, END = "2023-06", "2026-05"
OUT = Path(os.environ.get("IMPORT_RADAR_OUT", "import-radar-uk-no-output")); OUT.mkdir(parents=True, exist_ok=True)
CODES = set("846610,680520,680530,482110,846620,848420,848190,731822,848410,854160,401699,830210,830242,848390,850450,391910,842490,848071,848340,841490,848180,848210,841231,853650,391990,846693,830241,853690,731816,761699,853400,392350,853810,846799,854442,731815,853610,853630,853641,853649,853669,960390,842420,830140,841350,841360,841370,853620,481910,841459".split(","))
GBP_USD, NOK_USD = 1.28, 0.095
UK_ARCHIVES = [
 ("2023H2","https://www.uktradeinfo.com/media/cykmlmkf/bdsimp_jul-dec23archive.zip"),
 ("2024H1","https://www.uktradeinfo.com/media/c1rlakyp/bdsimp_jan-jun24archive.zip"),
 ("2024H2","https://www.uktradeinfo.com/media/sgyhxio1/bdsimp_jul-dec24archive.zip"),
 ("2025H1","https://www.uktradeinfo.com/media/rzloztvw/bdsimp_jan-jun25archive.zip"),
 ("2025H2","https://www.uktradeinfo.com/media/utwhkjjx/bdsimp_jul-dec25archive.zip"),
 ("2026H1","https://www.uktradeinfo.com/media/4d1dpb4r/bdsimp_jan-jun26archive.zip"),
]

def months():
 y,m=2023,6; out=[]
 while (y,m)<=(2026,5):
  out.append(f"{y:04d}-{m:02d}"); m+=1
  if m==13:y+=1;m=1
 return out
MONTHS=months(); PERIODS={m.replace('-','') for m in MONTHS}
def num_bytes(b):
 try:return float(b.decode('ascii','ignore').strip() or 0)
 except:return 0.0

def download(s,url,path):
 last=None
 for attempt in range(5):
  try:
   with s.get(url,stream=True,timeout=(30,600),allow_redirects=True) as r:
    r.raise_for_status()
    with open(path,'wb') as f:
     for chunk in r.iter_content(1024*1024):
      if chunk:f.write(chunk)
   if not zipfile.is_zipfile(path):raise RuntimeError(f"not zip {open(path,'rb').read(100)!r}")
   return
  except Exception as e:
   last=e; time.sleep(2**attempt)
 raise RuntimeError(f"download failed {url}: {last}")

def uk_fetch(s):
 agg=defaultdict(lambda:{"world_value_usd":0.0,"china_value_usd":0.0,"world_kg":0.0,"china_kg":0.0}); logs=[]
 with tempfile.TemporaryDirectory(prefix='uk-bulk-') as td:
  for label,url in UK_ARCHIVES:
   p=Path(td)/f'{label}.zip'; download(s,url,p)
   parsed=matched=bad=0; members=[]; first=''
   with zipfile.ZipFile(p) as z:
    members=[i.filename for i in z.infolist() if not i.is_dir()]
    for info in z.infolist():
     if info.is_dir():continue
     with z.open(info) as f:
      for raw in f:
       raw=raw.rstrip(b'\r\n')
       if len(raw)<85:bad+=1;continue
       if not first:first=raw[:90].decode('latin-1','replace')
       period=raw[0:6].decode('ascii','ignore')
       line_type=raw[6:7]
       code8=raw[13:21].decode('ascii','ignore')
       rec_type=raw[84:85]
       if period not in PERIODS or line_type!=b'1' or rec_type not in (b'0',b'1'):continue
       code=code8[:6]
       if code not in CODES:continue
       parsed+=1; matched+=1
       dispatch=raw[29:31].decode('ascii','ignore').upper()
       origin=raw[40:42].decode('ascii','ignore').upper()
       value=num_bytes(raw[44:56]); kg=num_bytes(raw[56:68])
       month=f'{period[:4]}-{period[4:6]}'
       agg[(month,code)]['world_value_usd'] += value*GBP_USD
       agg[(month,code)]['world_kg'] += kg
       if dispatch=='CN' or origin=='CN':
        agg[(month,code)]['china_value_usd'] += value*GBP_USD
        agg[(month,code)]['china_kg'] += kg
   logs.append({'source':'UK_HMRC_BULK','archive':label,'bytes':p.stat().st_size,'members':'|'.join(members),'matched_rows':matched,'short_rows':bad,'sample':first})
   print(label,p.stat().st_size,members,matched,flush=True)
 return agg,logs

def dim(meta,words):
 words=[w.lower() for w in words]
 for v in meta.get('variables',[]):
  label=(str(v.get('text',''))+' '+str(v.get('code',''))).lower()
  if all(w in label for w in words):return v
 for v in meta.get('variables',[]):
  label=(str(v.get('text',''))+' '+str(v.get('code',''))).lower()
  if any(w in label for w in words):return v
 raise KeyError(words)
def n(v):
 try:return float(str(v).replace(' ','').replace(',','.'))
 except:return 0.0

def no_fetch(s):
 url='https://data.ssb.no/api/v0/en/table/08799'; meta=s.get(url,timeout=120).json()
 t=dim(meta,['month']); com=dim(meta,['commodity']); ie=dim(meta,['import']); country=dim(meta,['country']); contents=dim(meta,['contents'])
 countries=[v for v,x in zip(country['values'],country['valueTexts']) if 'china' in str(x).lower() or 'all countries' in str(x).lower() or str(x).lower().strip() in {'world','total'}]
 imports=[v for v,x in zip(ie['values'],ie['valueTexts']) if 'import' in str(x).lower()]
 values=[v for v,x in zip(contents['values'],contents['valueTexts']) if str(x).lower().startswith('value')]
 commodities=[]
 for v,x in zip(com['values'],com['valueTexts']):
  dv=re.sub(r'\D','',str(v)); dx=re.sub(r'\D','',str(x)); lead=dv[:8] if len(dv)>=8 else dx[:8]
  if len(lead)>=6 and lead[:6] in CODES:commodities.append(v)
 if len(countries)<2 or not imports or not values or not commodities:raise RuntimeError(f'SSB unresolved country={countries} imports={imports} values={values} commodities={len(commodities)}')
 selected={t['code']:[m.replace('-','M') for m in MONTHS],com['code']:commodities,ie['code']:[imports[0]],country['code']:countries,contents['code']:[values[0]]}
 query=[]
 for v in meta['variables']:
  vals=selected.get(v['code'])
  if vals is None:vals=[v['values'][0]]
  query.append({'code':v['code'],'selection':{'filter':'item','values':vals}})
 r=s.post(url,json={'query':query,'response':{'format':'csv'}},timeout=300); r.raise_for_status(); text=r.content.decode('utf-8-sig',errors='replace')
 dialect=csv.Sniffer().sniff(text[:4096],delimiters=';,\t'); rows=list(csv.DictReader(io.StringIO(text),dialect=dialect))
 agg=defaultdict(lambda:{"world_value_usd":0.0,"china_value_usd":0.0,"world_kg":0.0,"china_kg":0.0})
 def by(row,var):
  for k,v in row.items():
   if k and (k.lower()==str(var['code']).lower() or str(var.get('text','')).lower() in k.lower()):return str(v)
  return ''
 for row in rows:
  month=by(row,t).replace('M','-'); ctry=by(row,country).lower(); digits=re.sub(r'\D','',by(row,com)); code=digits[:6]
  if month not in MONTHS or code not in CODES:continue
  val=next((n(v) for k,v in row.items() if k and 'value' in k.lower()),n(list(row.values())[-1]))
  prefix='china' if 'china' in ctry else 'world'; agg[(month,code)][f'{prefix}_value_usd'] += val*NOK_USD
 return agg,[{'source':'NO_SSB','rows':len(rows),'commodities':len(commodities),'countries':'|'.join(countries),'columns':'|'.join(rows[0].keys()) if rows else ''}]

def write(path,rows):
 with path.open('w',newline='',encoding='utf-8-sig') as f:
  w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
def main():
 s=requests.Session();s.headers.update({'User-Agent':'Mozilla/5.0 ImportRadar/1.0'})
 uk,ul=uk_fetch(s); no,nl=no_fetch(s); out=[]
 for market,a in [('UK',uk),('NO',no)]:
  for m in MONTHS:
   for c in sorted(CODES):out.append({'market':market,'month':m,'hs6':c,**{k:round(v,3) for k,v in a[(m,c)].items()}})
 write(OUT/'uk_no_monthly_hs6.csv',out);write(OUT/'request_log.csv',ul+nl)
 q=[]
 for market in ['UK','NO']:
  rr=[x for x in out if x['market']==market];q.append({'market':market,'rows':len(rr),'nonzero_world_rows':sum(x['world_value_usd']>0 for x in rr),'nonzero_china_rows':sum(x['china_value_usd']>0 for x in rr),'latest_nonzero_month':max((x['month'] for x in rr if x['world_value_usd']>0),default='')})
 write(OUT/'uk_no_data_quality.csv',q)
 meta={'generated_at_utc':datetime.now(timezone.utc).isoformat(),'sources':{'UK':'HMRC UK Trade Info BDS import bulk archives','NO':'Statistics Norway Statbank table 08799'},'window':{'start':START,'end':END,'months':36},'fx_assumptions':{'GBP_USD':GBP_USD,'NOK_USD':NOK_USD},'candidate_codes':len(CODES),'row_count':len(out),'quality':q}
 (OUT/'run_metadata.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(meta,indent=2))
if __name__=='__main__':main()
