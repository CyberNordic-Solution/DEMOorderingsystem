#!/usr/bin/env python3
from __future__ import annotations
import csv, io, json, os, re, time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
import requests

START, END = "2023-06", "2026-05"
OUT = Path(os.environ.get("IMPORT_RADAR_OUT", "import-radar-uk-no-output")); OUT.mkdir(parents=True, exist_ok=True)
CODES = "846610,680520,680530,482110,846620,848420,848190,731822,848410,854160,401699,830210,830242,848390,850450,391910,842490,848071,848340,841490,848180,848210,841231,853650,391990,846693,830241,853690,731816,761699,853400,392350,853810,846799,854442,731815,853610,853630,853641,853649,853669,960390,842420,830140,841350,841360,841370,853620,481910,841459".split(",")
GBP_USD, NOK_USD = 1.28, 0.095

def months():
    y,m=2023,6; out=[]
    while (y,m)<=(2026,5):
        out.append(f"{y:04d}-{m:02d}"); m+=1
        if m==13: y+=1; m=1
    return out
MONTHS=months()
def chunks(v,n): return [v[i:i+n] for i in range(0,len(v),n)]
def num(v):
    try:return float(str(v).replace(" ","").replace(",","."))
    except:return 0.0

def uk_fetch(s):
    agg=defaultdict(lambda:{"world_value_usd":0.0,"china_value_usd":0.0,"world_kg":0.0,"china_kg":0.0}); logs=[]
    for batch in chunks(CODES,5):
        filt=" or ".join(f"Commodity/Hs6Code eq '{c}'" for c in batch)
        for china,prefix in ((False,"world"),(True,"china")):
            f=f"MonthId ge 202306 and MonthId le 202605 and (FlowTypeId eq 1 or FlowTypeId eq 3) and ({filt})"
            if china:f += " and Country/CountryName eq 'China'"
            apply=f"filter({f})/groupby((MonthId,CommodityId),aggregate(Value with sum as TotalValue,NetMass with sum as TotalMass))"
            url="https://api.uktradeinfo.com/OTS"; params={"$apply":apply,"$top":"10000"}; rows=[]
            while url:
                r=s.get(url,params=params if '?' not in url else None,timeout=180); r.raise_for_status(); p=r.json()
                rows.extend(p.get("value",[])); url=p.get("@odata.nextLink"); params=None
            logs.append({"source":"UK_HMRC","batch":batch[0],"partner":prefix,"rows":len(rows)})
            for row in rows:
                raw=str(row.get("MonthId") or ""); month=f"{raw[:4]}-{raw[4:6]}"; cid=str(row.get("CommodityId") or "").zfill(8); code=cid[:6]
                if month not in MONTHS or code not in CODES:continue
                agg[(month,code)][f"{prefix}_value_usd"] += num(row.get("TotalValue"))*GBP_USD
                agg[(month,code)][f"{prefix}_kg"] += num(row.get("TotalMass"))
            time.sleep(1.05)
    return agg,logs

def dim(meta,word):
    for v in meta.get("variables",[]):
        if word in (str(v.get("text",""))+str(v.get("code",""))).lower():return v
    raise KeyError(word)
def no_fetch(s):
    url="https://data.ssb.no/api/v0/en/table/08799"; meta=s.get(url,timeout=120).json()
    t,com,ie,country,contents=(dim(meta,"month"),dim(meta,"commodity"),dim(meta,"import"),dim(meta,"country"),dim(meta,"contents"))
    countries=[v for v,x in zip(country['values'],country['valueTexts']) if 'china' in x.lower() or 'all countries' in x.lower() or x.lower().strip() in {'world','total'}]
    imports=[v for v,x in zip(ie['values'],ie['valueTexts']) if 'import' in x.lower()]
    values=[v for v,x in zip(contents['values'],contents['valueTexts']) if x.lower().startswith('value')]
    commodities=[]
    for v,x in zip(com['values'],com['valueTexts']):
        d=re.sub(r'\D','',str(v)); dx=re.sub(r'\D','',str(x)); lead=d[:8] if len(d)>=8 else dx[:8]
        if len(lead)>=6 and lead[:6] in CODES:commodities.append(v)
    if len(countries)<2 or not imports or not values or not commodities:raise RuntimeError(f"SSB dimensions unresolved c={countries} i={imports} v={values} commodities={len(commodities)}")
    selected={t['code']:[m.replace('-','M') for m in MONTHS],com['code']:commodities,ie['code']:[imports[0]],country['code']:countries,contents['code']:[values[0]]}
    query=[{"code":v['code'],"selection":{"filter":"item","values":selected.get(v['code'],[v['values'][0]])}} for v in meta['variables']]
    r=s.post(url,json={"query":query,"response":{"format":"csv"}},timeout=300); r.raise_for_status(); text=r.content.decode('utf-8-sig',errors='replace')
    dialect=csv.Sniffer().sniff(text[:4096],delimiters=';,\t'); rows=list(csv.DictReader(io.StringIO(text),dialect=dialect))
    agg=defaultdict(lambda:{"world_value_usd":0.0,"china_value_usd":0.0,"world_kg":0.0,"china_kg":0.0})
    def by(row,var):
        for k,v in row.items():
            if k and (k.lower()==var['code'].lower() or str(var.get('text','')).lower() in k.lower()):return str(v)
        return ''
    for row in rows:
        month=by(row,t).replace('M','-'); ctry=by(row,country).lower(); digits=re.sub(r'\D','',by(row,com)); code=digits[:6]
        if month not in MONTHS or code not in CODES:continue
        val=next((num(v) for k,v in row.items() if k and 'value' in k.lower()),num(list(row.values())[-1]))
        prefix='china' if 'china' in ctry else 'world'; agg[(month,code)][f"{prefix}_value_usd"] += val*NOK_USD
    return agg,[{"source":"NO_SSB","rows":len(rows),"commodities":len(commodities)}]

def write(path,rows):
    with path.open('w',newline='',encoding='utf-8-sig') as f:w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
def main():
    s=requests.Session();s.headers.update({'User-Agent':'ImportRadar/1.0 public-data research'})
    uk,ul=uk_fetch(s); no,nl=no_fetch(s); out=[]
    for market,a in [('UK',uk),('NO',no)]:
        for m in MONTHS:
            for c in CODES:out.append({'market':market,'month':m,'hs6':c,**{k:round(v,3) for k,v in a[(m,c)].items()}})
    write(OUT/'uk_no_monthly_hs6.csv',out);write(OUT/'request_log.csv',ul+nl)
    q=[]
    for market in ['UK','NO']:
        rr=[x for x in out if x['market']==market];q.append({'market':market,'rows':len(rr),'nonzero_world_rows':sum(x['world_value_usd']>0 for x in rr),'nonzero_china_rows':sum(x['china_value_usd']>0 for x in rr)})
    write(OUT/'uk_no_data_quality.csv',q)
    meta={'generated_at_utc':datetime.now(timezone.utc).isoformat(),'sources':{'UK':'HMRC UK Trade Info OTS API','NO':'Statistics Norway table 08799'},'window':{'start':START,'end':END,'months':36},'fx_assumptions':{'GBP_USD':GBP_USD,'NOK_USD':NOK_USD},'candidate_codes':len(CODES),'row_count':len(out),'quality':q}
    (OUT/'run_metadata.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(meta,indent=2))
if __name__=='__main__':main()
