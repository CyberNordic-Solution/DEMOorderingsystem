#!/usr/bin/env python3
from __future__ import annotations
import json
from datetime import datetime, timezone

import import_radar_uk_no_bulk as base


def main():
    session = base.requests.Session()
    session.headers.update({'User-Agent': 'Mozilla/5.0 ImportRadar/1.0'})
    aggregate, logs = base.uk_fetch(session)
    output = []
    for month in base.MONTHS:
        for code in sorted(base.CODES):
            output.append({
                'market': 'UK',
                'month': month,
                'hs6': code,
                **{key: round(value, 3) for key, value in aggregate[(month, code)].items()},
            })
    base.write(base.OUT / 'uk_monthly_hs6.csv', output)
    base.write(base.OUT / 'request_log.csv', logs)
    quality = [{
        'market': 'UK',
        'rows': len(output),
        'nonzero_world_rows': sum(row['world_value_usd'] > 0 for row in output),
        'nonzero_china_rows': sum(row['china_value_usd'] > 0 for row in output),
        'latest_nonzero_month': max((row['month'] for row in output if row['world_value_usd'] > 0), default=''),
    }]
    base.write(base.OUT / 'uk_data_quality.csv', quality)
    metadata = {
        'generated_at_utc': datetime.now(timezone.utc).isoformat(),
        'source': 'HMRC UK Trade Info BDS import bulk archives',
        'window': {'start': base.START, 'end': base.END, 'months': 36},
        'fx_assumption': {'GBP_USD': base.GBP_USD},
        'candidate_codes': len(base.CODES),
        'row_count': len(output),
        'quality': quality,
    }
    (base.OUT / 'run_metadata.json').write_text(json.dumps(metadata, indent=2), encoding='utf-8')
    print(json.dumps(metadata, indent=2))


if __name__ == '__main__':
    main()
