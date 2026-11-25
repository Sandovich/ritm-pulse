"""Проверки серверного времени, прав и счёта без подмены клиентских часов."""
import importlib.util,sqlite3,sys
from pathlib import Path
path=Path(__file__).resolve().parents[1]/'web/server.py'
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('pulse',path);pulse=importlib.util.module_from_spec(spec);spec.loader.exec_module(pulse)
db=sqlite3.connect(':memory:');db.row_factory=sqlite3.Row;db.executescript(pulse.SQL)
for p in ('a','b','outside'):
    db.execute('INSERT INTO people(id,session_hash,goal) VALUES(?,?,?)',(p,p,'Питание'))
t=1795640000
def do(p,verb,when,**kw):return pulse.operate(db,p,verb,kw,when)
def done(p,when,kind,**kw):return do(p,'done',when,kind=kind,minutes=10,task=kind,visibility='circle',**kw)
def bad(f):
    try:f()
    except pulse.Bad:return
    raise AssertionError('Нужен отказ')
done('a',t,'move');gid=do('a','create',t+1,mode='relay',kind='move')['game']
tok=db.execute('SELECT token FROM games WHERE id=?',(gid,)).fetchone()[0]
do('b','join',t+2,token=tok,kind='walk');done('b',t+3,'walk',game=gid);done('b',t+4,'walk',game=gid)
bad(lambda:done('outside',t+5,'walk',game=gid));bad(lambda:done('b',t+86401,'walk',game=gid))
assert db.execute("SELECT COUNT(*) FROM events WHERE kind='relay_completed'").fetchone()[0]==1
gid=do('a','create',t+10,mode='duel',kind='move')['game'];tok=db.execute('SELECT token FROM games WHERE id=?',(gid,)).fetchone()[0]
do('b','join',t+11,token=tok,kind='move')
bad(lambda:done('a',t+12,'move',game=gid))
for d in range(7):done('b',t+d*86400+20,'move',game=gid)
bad(lambda:done('b',t+7*86400+20,'move',game=gid));assert db.execute('SELECT COUNT(*) FROM marks WHERE game=? AND person=?',(gid,'b')).fetchone()[0]==7
assert len(pulse.snapshot(db,'outside',t)['games'])==0
print('OK: participant identity, server expiry, replay, independent time, limit of seven duel points')

gid=do('a','create',t+2000000,mode='circle',kind='move')['game']
tok=db.execute('SELECT token FROM games WHERE id=?',(gid,)).fetchone()[0]
do('b','join',t+2000001,token=tok,kind='walk')
src=done('a',t+2000002,'move')['action']
do('b','done',t+2000003,kind='food',minutes=15,task=pulse.FOOD[0],game=gid,source=src,visibility='circle')
do('b','done',t+2000004,kind='food',minutes=15,task=pulse.FOOD[0],game=gid,source=src,visibility='circle')
assert db.execute('SELECT COUNT(*) FROM replies').fetchone()[0]==1
assert any(p['answered'] for p in pulse.snapshot(db,'b',t+2000004)['pulse'])
bad(lambda:do('outside','done',t+2000005,kind='food',minutes=15,task=pulse.FOOD[0],game=gid,source=src,visibility='circle'))
print('OK: cross-goal response, duplicate and circle visibility')
