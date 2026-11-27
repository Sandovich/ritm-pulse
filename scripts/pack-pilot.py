"""Build an archive of the current pilot and its complete regression suite."""
import argparse
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument("output",type=Path)
args=parser.parse_args()
files=[root/name for name in ("PILOT-NEXT.md","ASSETS.md","requirements-pilot-tests.txt")]
files.extend((root/"web").glob("*.py"))
for suffix in ("html","js","css","webmanifest","png"):
    files.extend((root/"web").glob("*."+suffix))
files.extend(p for p in (root/"web/assets").rglob("*") if p.is_file())
files.extend((root/"analysis").glob("*.py"))
files.extend((root/"analysis").glob("*.sql"))
for name in ("check-choice.py","check-rules.py","check-season.py","check-push.py","next_backup.py","next_diaries.py","next_exchange.py","choice_pilot.py","home_review.py","origin_outage.py","run-pilot.py"):
    files.append(root/"tests"/name)
with ZipFile(args.output,"x",ZIP_DEFLATED) as archive:
    for path in sorted(files):
        archive.write(path,path.relative_to(root))

