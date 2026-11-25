"""Локальные регрессионные проверки на синтетических данных, Python 3."""
import sqlite3
from pathlib import Path
P=Path(__file__).resolve().parent
db=sqlite3.connect(':memory:');db.row_factory=sqlite3.Row
db.executescript((P/'pilot-schema.sql').read_text('utf-8-sig'))
db.executescript("""
INSERT INTO clusters VALUES('group1','pilot','ritm');
INSERT INTO people VALUES('a','2026-01-01 00:00:00','direct_unknown',0),('b','2026-01-01 00:00:00','invite',1),('c','2026-01-01 00:00:00','invite',1);
INSERT INTO assignments SELECT person,'group1','2026-01-01 00:00:00','A' FROM people;
INSERT INTO alternatives VALUES('a','A','short');
INSERT INTO completions VALUES('1','a','2026-01-02 00:00:00','A','short'),('2','a','2026-01-02 00:00:00','A','short'),('3','b','2026-01-02 00:00:00','wrong','wrong'),('4','b','2026-01-08 00:00:00','A','A'),('5','c','2026-01-07 23:59:59','A','A');
INSERT INTO offers VALUES('o','a','2026-01-02 00:00:00','season'),('late','c','2026-03-09 00:00:00','season');
INSERT INTO orders VALUES('sale','o','2026-01-04 00:00:00',10000);
INSERT INTO refunds VALUES('r1','sale','2026-03-08 00:00:00',2000),('r2','sale','2026-03-10 00:00:00',8000);
INSERT INTO activity VALUES('1','b',NULL,'action_completed','2026-01-08 00:00:00',5),('2','c',NULL,'invite_viewed','2026-01-08 00:00:00',NULL);
""")
def run(file,date):return [dict(r) for r in db.execute((P/file).read_text('utf-8-sig'),{'as_of':date+' 00:00:00'})]
early=run('pilot-metrics.sql','2026-01-05')[0];assert early['eligible7']==early['eligible60']==0
a=run('pilot-metrics.sql','2026-03-09')[0];assert (a['assigned'],a['eligible7'],a['returned7'],a['original7'],a['offered'],a['eligible60'],a['renewed60'])==(3,3,2,1,2,1,1)
assert run('pilot-metrics.sql','2026-03-11')[0]['renewed60']==0
assert run('pilot-metrics.sql','2026-03-09')[0]==a
assert run('social-metrics.sql','2026-03-10')[1]['active_d7']==1
print('OK: wrong task, time windows, approved alternative, duplicates, offer denominator, historical and partial refunds, guest D7')
