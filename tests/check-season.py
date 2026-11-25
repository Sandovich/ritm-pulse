"""Synthetic checks. No live clients, charges or notifications."""
import contextlib
import importlib.util
import io
import sqlite3
import sys
from pathlib import Path
root=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(root/'web'),str(root/'analysis')]
import server,season,sales
c=sqlite3.connect(':memory:');c.row_factory=sqlite3.Row;c.executescript(server.SQL)
for who in ('a','b','c'):
    c.execute('INSERT INTO people(id,session_hash,goal) VALUES(?,?,?)',(who,who,'Питание'))
def op(w,verb,t,**kw):
    with c:return server.operate(c,w,verb,kw,t)
def err(f):
    try:f()
    except ValueError:return
    raise AssertionError('Expected refusal')
t=1795639930
for w in ('a','b','c'):op(w,'allocate',t,channel='direct')
v=season.state(c,'a',t)['allocation'];op('a','allocate',t+1,channel='artem');assert season.state(c,'a',t)['allocation']==v
op('a','exposure',t,step='offers');b=op('a','book',t+1,sku='DUO')['ref'];assert b==op('a','book',t+2,sku='DUO')['ref']
err(lambda:op('a','book',t+3,sku='RESET'));sales.record(c,b,'demo','paid',299000,t+5,'artem');sales.record(c,b,'demo','paid',299000,t+5,'artem')
sales.record(c,b,'ret','refund',100000,t+8,'artem');sales.record(c,b,'ret2','refund',199000,t+9,'artem');err(lambda:sales.record(c,b,'bad','refund',1,t+10,'artem'))
for cut,expected in [(t+4,'1 1 0 0 0 0.0 0.0'),(t+6,'1 1 1 1 2 2990.0 2990.0'),(t+10,'1 1 1 0 0 0.0 0.0')]:
    with contextlib.redirect_stdout(io.StringIO()) as capture:sales.report(c,cut)
    assert expected in capture.getvalue(),capture.getvalue()
plan={k:v[0] for k,v in season.FIELDS.items()};op('a','season',t,plan=plan,baseline=1,target=3)
err(lambda:op('a','checkin',t,week=4,actual=3,ease=4));op('a','checkin',t+27*86400,week=4,actual=3,ease=4)
assert season.state(c,'a',t+27*86400)['season']['checkins'][0]['actual']==3
assert season.state(c,'b',t)['season'] is None
gid=op('a','create',t,mode='circle',kind='move')['game']
tok=c.execute('SELECT token FROM games WHERE id=?',(gid,)).fetchone()[0]
for w in ('b','c'):op(w,'join',t+1,token=tok,kind='move')
def done(w,kind,at,visibility='circle',**more):
    return op(w,'done',at,kind=kind,minutes=10,task=seasonfood if kind=='food' else kind,visibility=visibility,**more)['action']
seasonfood=server.FOOD[0]
aid=done('a','move',t+5); cid=done('c','walk',t+6)
nextday=t+23*3600
done('b','walk',nextday,game=gid,source=aid);err(lambda:done('b','walk',nextday+1,game=gid,source=cid))
err(lambda:done('c','food',t+5+86400,game=gid,source=aid))
a2=done('a','food',nextday+2,'private')
assert a2 not in str(server.snapshot(c,'b',nextday+2)['pulse']);op('a','hide',nextday+4,action=aid)
assert aid not in str(server.snapshot(c,'b',nextday+5)['pulse'])
op('b','leave',nextday+5,game=gid);assert not server.snapshot(c,'b',nextday+5)['games']
err(lambda:done('b','food',nextday+6,game=gid,source=cid))
print('OK • offers, payment attribution, refunds, personal goal, delayed outcome, 24h Pulse, distinct replies, privacy and exit')
