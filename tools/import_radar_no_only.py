#!/usr/bin/env python3
from __future__ import annotations

import csv
import io
import json
import os
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import requests

OUT = Path(os.environ.get('IMPORT_RADAR_OUT', 'import-radar-no-output'))
OUT.mkdir(parents=True, exist_ok=True)
NOK_USD = 0.095
CODES = set('846610,680520,680530,482110,846620,848420,848190,731822,848410,854160,401699,830210,830242,848390,850450,391910,842490,848071,848340,841490,848180,848210,841231,853650,391990,846693,830241,853690,731816,761699,853400,392350,853810,846799,854442,731815,853610,853630,853641,853649,853669,960390,842420,830140,841350,841360,841370,853620,481910,841459'.split(','))


def months():
    year, month = 2023, 6
    output = []
    while (year, month) <= (2026, 5):
        output.append(f'{year:04d}-{month:02d}')
        month += 1
        if month == 13:
            year += 1
            month = 1
    return output


MONTHS = months()


def chunks(values, size):
    return [values[i:i + size] for i in range(0, len(values), size)]


def number(value):
    try:
        return float(str(value).replace(' ', '').replace(',', '.'))
    except (TypeError, ValueError):
        return 0.0


def find_dimension(metadata, words):
    words = [word.lower() for word in words]
    for variable in metadata.get('variables', []):
        label = (str(variable.get('text', '')) + ' ' + str(variable.get('code', ''))).lower()
        if all(word in label for word in words):
            return variable
    for variable in metadata.get('variables', []):
        label = (str(variable.get('text', '')) + ' ' + str(variable.get('code', ''))).lower()
        if any(word in label for word in words):
            return variable
    raise KeyError(words)


def main():
    session = requests.Session()
    session.headers.update({'User-Agent': 'ImportRadar/1.0 public-data research'})
    url = 'https://data.ssb.no/api/v0/en/table/08799'
    metadata = session.get(url, timeout=120).json()
    time_var = find_dimension(metadata, ['month'])
    commodity_var = find_dimension(metadata, ['commodity'])
    flow_var = find_dimension(metadata, ['import'])
    country_var = find_dimension(metadata, ['country'])
    contents_var = find_dimension(metadata, ['contents'])

    import_values = [v for v, text in zip(flow_var['values'], flow_var['valueTexts']) if 'import' in str(text).lower()]
    value_contents = [v for v, text in zip(contents_var['values'], contents_var['valueTexts']) if str(text).lower().startswith('value')]
    commodity_values = []
    for value, text in zip(commodity_var['values'], commodity_var['valueTexts']):
        value_digits = re.sub(r'\D', '', str(value))
        text_digits = re.sub(r'\D', '', str(text))
        leading = value_digits[:8] if len(value_digits) >= 8 else text_digits[:8]
        if len(leading) >= 6 and leading[:6] in CODES:
            commodity_values.append(value)
    if not import_values or not value_contents or not commodity_values:
        raise RuntimeError(f'Unresolved SSB dimensions: imports={import_values}, values={value_contents}, commodities={len(commodity_values)}')

    aggregate = defaultdict(lambda: {
        'world_value_usd': 0.0,
        'china_value_usd': 0.0,
        'world_kg': 0.0,
        'china_kg': 0.0,
    })
    request_log = []

    for batch_index, commodity_batch in enumerate(chunks(commodity_values, 10), 1):
        query = []
        for variable in metadata['variables']:
            code = variable['code']
            if code == time_var['code']:
                selection = {'filter': 'item', 'values': [month.replace('-', 'M') for month in MONTHS]}
            elif code == commodity_var['code']:
                selection = {'filter': 'item', 'values': commodity_batch}
            elif code == flow_var['code']:
                selection = {'filter': 'item', 'values': [import_values[0]]}
            elif code == country_var['code']:
                selection = {'filter': 'all', 'values': ['*']}
            elif code == contents_var['code']:
                selection = {'filter': 'item', 'values': [value_contents[0]]}
            else:
                selection = {'filter': 'item', 'values': [variable['values'][0]]}
            query.append({'code': code, 'selection': selection})

        response = session.post(url, json={'query': query, 'response': {'format': 'csv'}}, timeout=300)
        if response.status_code >= 400:
            raise RuntimeError(f'SSB batch {batch_index}: {response.status_code} {response.text[:1000]}')
        text = response.content.decode('utf-8-sig', errors='replace')
        dialect = csv.Sniffer().sniff(text[:4096], delimiters=';,\t')
        rows = list(csv.DictReader(io.StringIO(text), dialect=dialect))
        request_log.append({
            'batch': batch_index,
            'commodity_values': len(commodity_batch),
            'rows': len(rows),
            'columns': '|'.join(rows[0].keys()) if rows else '',
        })
        print('batch', batch_index, 'rows', len(rows), flush=True)

        for row in rows:
            commodity_text = str(row.get('commodity number', ''))
            digits = re.sub(r'\D', '', commodity_text)
            hs6 = digits[:6]
            if hs6 not in CODES:
                continue
            country_text = str(row.get('country', '')).lower()
            is_china = 'china' in country_text
            for column, raw_value in row.items():
                match = re.match(r'Value \(NOK\) (\d{4})M(\d{2})$', str(column))
                if not match:
                    continue
                month = f'{match.group(1)}-{match.group(2)}'
                if month not in MONTHS:
                    continue
                value_usd = number(raw_value) * NOK_USD
                aggregate[(month, hs6)]['world_value_usd'] += value_usd
                if is_china:
                    aggregate[(month, hs6)]['china_value_usd'] += value_usd

    output = []
    for month in MONTHS:
        for hs6 in sorted(CODES):
            output.append({
                'market': 'NO',
                'month': month,
                'hs6': hs6,
                **{key: round(value, 3) for key, value in aggregate[(month, hs6)].items()},
            })

    with (OUT / 'no_monthly_hs6.csv').open('w', newline='', encoding='utf-8-sig') as handle:
        writer = csv.DictWriter(handle, fieldnames=list(output[0].keys()))
        writer.writeheader()
        writer.writerows(output)
    with (OUT / 'request_log.csv').open('w', newline='', encoding='utf-8-sig') as handle:
        writer = csv.DictWriter(handle, fieldnames=list(request_log[0].keys()))
        writer.writeheader()
        writer.writerows(request_log)

    quality = {
        'market': 'NO',
        'rows': len(output),
        'nonzero_world_rows': sum(row['world_value_usd'] > 0 for row in output),
        'nonzero_china_rows': sum(row['china_value_usd'] > 0 for row in output),
        'latest_nonzero_month': max((row['month'] for row in output if row['world_value_usd'] > 0), default=''),
    }
    metadata_output = {
        'generated_at_utc': datetime.now(timezone.utc).isoformat(),
        'source': 'Statistics Norway Statbank table 08799',
        'window': {'start': '2023-06', 'end': '2026-05', 'months': 36},
        'fx_assumption': {'NOK_USD': NOK_USD},
        'candidate_codes': len(CODES),
        'row_count': len(output),
        'quality': quality,
    }
    (OUT / 'run_metadata.json').write_text(json.dumps(metadata_output, indent=2), encoding='utf-8')
    print(json.dumps(metadata_output, indent=2))


if __name__ == '__main__':
    main()
