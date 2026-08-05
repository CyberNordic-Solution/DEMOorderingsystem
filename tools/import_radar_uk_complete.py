#!/usr/bin/env python3
from __future__ import annotations

import import_radar_uk_no_bulk as base
import import_radar_uk_only as uk_only

base.UK_ARCHIVES = [
    ("2023H1", "https://www.uktradeinfo.com/media/zf1kevsi/bdsimp_jan-jun23archive.zip"),
    *base.UK_ARCHIVES,
    ("2026M05", "https://www.uktradeinfo.com/media/cjilp2jp/bdsimp2605.zip"),
]

if __name__ == "__main__":
    uk_only.main()
