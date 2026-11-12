#!/usr/bin/env python3
"""Reproduce the bundled selection from the November 2026 FIDE Standard ZIP.
Usage: python3 scripts/build-fide-snapshot.py /path/to/standard_rating_list.zip
Obtain source from https://ratings.fide.com/download_lists.phtml. The live download
changes monthly; this script deliberately requires the exact archived source ZIP.
"""
import collections
import hashlib
import json
from pathlib import Path
import sys
import zipfile

ROOT = Path(__file__).resolve().parent.parent
SOURCE_SHA256 = hashlib.sha256(Path(sys.argv[1]).read_bytes()).hexdigest() if len(sys.argv) == 2 else ''
# Pin the source so a different month's ratings cannot be mislabeled as November.
EXPECTED_SHA256 = 'd305e80ef5db85f416576417996f4dd96d259dfc99f04cc0cfc75b900ba5e2b1'
if SOURCE_SHA256 != EXPECTED_SHA256:
    raise SystemExit('Pass the original November 2026 ZIP; source checksum does not match.')
mapping = json.loads((ROOT / 'scripts/data/fide-country-map.json').read_text())
rows = []
with zipfile.ZipFile(sys.argv[1]) as source:
    lines = source.read('standard_rating_list.txt').decode('utf-8-sig').splitlines()[1:]
for line in lines:
    try:
        ident, rating, birth = int(line[:15]), int(line[113:119]), int(line[126:132])
    except ValueError:
        continue
    if 'i' in line[132:].lower() or rating < 1400 or not 1900 <= birth <= 2026:
        continue
    name = line[15:76].strip()
    parts = name.split(',', 1)
    if len(parts) == 2:
        name = f'{parts[1].strip()} {parts[0].strip()}'
    fed = line[76:80].strip()
    rows.append([ident, name, mapping.get(fed, fed), line[80:84].strip(),
                 line[84:89].strip() or line[89:94].strip(), rating, birth])
rows.sort(key=lambda row: (-row[5], row[0]))
selected = rows[:10000]
buckets = collections.defaultdict(list)
for row in rows[10000:]:
    buckets[row[2]].append(row)
# Stable varied lower-rated selection; no invented names or ratings.
for country, group in buckets.items():
    group.sort(key=lambda row: hashlib.sha256(f'chess-career-fide-2026:{row[0]}'.encode()).digest())
    buckets[country] = collections.deque(group)
while len(selected) < 20000:
    for country in sorted(buckets):
        if buckets[country] and len(selected) < 20000:
            selected.append(buckets[country].popleft())
selected.sort(key=lambda row: (-row[5], row[0]))
data = dict(schema=1, snapshotYear=2026, snapshotDate='2026-11-11', ratingMonth='2026-11',
            count=len(selected), eligibleSourceCount=len(rows),
            source='FIDE Standard Rating List November 2026',
            sourceUrl='https://ratings.fide.com/download_lists.phtml',
            downloadUrl='https://ratings.fide.com/download/standard_rating_list.zip',
            sourceZipSha256=SOURCE_SHA256,
            selection='Top 10000 active standard-rated players, plus 10000 lower-rated active players sampled deterministically round-robin across federations. Known birth year required. This is a selected subset, not the complete FIDE database.',
            columns=['fideId', 'name', 'federationCountry', 'sex', 'officialTitle', 'standardRating', 'birthYear'], rows=selected)
target = ROOT / 'public/data/fide/players-2026-11.json'
target.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':'))+'\n', encoding='utf-8')
print(f'{len(selected):,} real players / {len({row[2] for row in selected})} federations; {target.stat().st_size:,} bytes')
