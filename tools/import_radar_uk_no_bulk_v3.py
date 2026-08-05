#!/usr/bin/env python3
from __future__ import annotations

import csv

import import_radar_uk_no_bulk as base
import import_radar_uk_no_bulk_v2  # patches base.no_fetch


def write_union(path, rows):
    if not rows:
        path.write_text('', encoding='utf-8')
        return
    fieldnames = sorted({key for row in rows for key in row.keys()})
    with path.open('w', newline='', encoding='utf-8-sig') as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(rows)


base.write = write_union

if __name__ == '__main__':
    base.main()
