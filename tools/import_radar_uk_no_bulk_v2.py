#!/usr/bin/env python3
from __future__ import annotations

import csv
import io
import re

import import_radar_uk_no_bulk as base


def chunks(values, size):
    return [values[i:i + size] for i in range(0, len(values), size)]


def no_fetch(session):
    url = 'https://data.ssb.no/api/v0/en/table/08799'
    meta = session.get(url, timeout=120).json()
    time_var = base.dim(meta, ['month'])
    commodity_var = base.dim(meta, ['commodity'])
    flow_var = base.dim(meta, ['import'])
    country_var = base.dim(meta, ['country'])
    contents_var = base.dim(meta, ['contents'])

    import_values = [v for v, text in zip(flow_var['values'], flow_var['valueTexts']) if 'import' in str(text).lower()]
    value_contents = [v for v, text in zip(contents_var['values'], contents_var['valueTexts']) if str(text).lower().startswith('value')]
    commodity_values = []
    for value, text in zip(commodity_var['values'], commodity_var['valueTexts']):
        digits_value = re.sub(r'\D', '', str(value))
        digits_text = re.sub(r'\D', '', str(text))
        leading = digits_value[:8] if len(digits_value) >= 8 else digits_text[:8]
        if len(leading) >= 6 and leading[:6] in base.CODES:
            commodity_values.append(value)
    if not import_values or not value_contents or not commodity_values:
        raise RuntimeError(
            f'SSB unresolved imports={import_values} values={value_contents} commodities={len(commodity_values)}'
        )

    aggregate = base.defaultdict(
        lambda: {
            'world_value_usd': 0.0,
            'china_value_usd': 0.0,
            'world_kg': 0.0,
            'china_kg': 0.0,
        }
    )
    logs = []

    def read_dimension(row, variable):
        code = str(variable['code']).lower()
        text = str(variable.get('text', '')).lower()
        for key, value in row.items():
            if key and (key.lower() == code or text in key.lower()):
                return str(value)
        return ''

    for batch_index, batch in enumerate(chunks(commodity_values, 10), 1):
        query = []
        for variable in meta['variables']:
            code = variable['code']
            if code == time_var['code']:
                selection = {'filter': 'item', 'values': [m.replace('-', 'M') for m in base.MONTHS]}
            elif code == commodity_var['code']:
                selection = {'filter': 'item', 'values': batch}
            elif code == flow_var['code']:
                selection = {'filter': 'item', 'values': [import_values[0]]}
            elif code == country_var['code']:
                selection = {'filter': 'all', 'values': ['*']}
            elif code == contents_var['code']:
                selection = {'filter': 'item', 'values': [value_contents[0]]}
            else:
                selection = {'filter': 'item', 'values': [variable['values'][0]]}
            query.append({'code': code, 'selection': selection})

        response = session.post(
            url,
            json={'query': query, 'response': {'format': 'csv'}},
            timeout=300,
        )
        if response.status_code >= 400:
            raise RuntimeError(f'SSB batch {batch_index} error {response.status_code}: {response.text[:1000]}')
        text = response.content.decode('utf-8-sig', errors='replace')
        dialect = csv.Sniffer().sniff(text[:4096], delimiters=';,\t')
        rows = list(csv.DictReader(io.StringIO(text), dialect=dialect))
        logs.append({
            'source': 'NO_SSB',
            'batch': batch_index,
            'commodities': len(batch),
            'rows': len(rows),
            'columns': '|'.join(rows[0].keys()) if rows else '',
        })
        print('NO batch', batch_index, 'commodities', len(batch), 'rows', len(rows), flush=True)

        for row in rows:
            month = read_dimension(row, time_var).replace('M', '-')
            country = read_dimension(row, country_var).lower()
            commodity = read_dimension(row, commodity_var)
            digits = re.sub(r'\D', '', commodity)
            code = digits[:6]
            if month not in base.MONTHS or code not in base.CODES:
                continue
            value_nok = 0.0
            for key, raw_value in row.items():
                if key and 'value' in key.lower():
                    value_nok = base.n(raw_value)
                    break
            value_usd = value_nok * base.NOK_USD
            aggregate[(month, code)]['world_value_usd'] += value_usd
            if 'china' in country:
                aggregate[(month, code)]['china_value_usd'] += value_usd

    return aggregate, logs


base.no_fetch = no_fetch

if __name__ == '__main__':
    base.main()
