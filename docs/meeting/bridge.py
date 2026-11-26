"""Adapter from local browser storage to the application's own rules."""
import json
import sqlite3
from contextlib import closing
from urllib.parse import urlsplit, parse_qs
import core
from fixture import home_plan, seed

def request(raw):
    query=json.loads(raw)
    route=urlsplit(query['path'])
    actor='demo-'+('friend' if query['actor']=='friend' else 'owner')
    t=query.get('clock') or core.now()
    with closing(sqlite3.connect('/device.sqlite')) as c:
        c.row_factory=sqlite3.Row
        c.execute('PRAGMA foreign_keys=ON')
        c.executescript(core.SQL)
        with c:
            added=c.execute('INSERT OR IGNORE INTO people(id,session_hash,name) VALUES(?,?,?)',(actor,actor,'Друг' if actor.endswith('friend') else '')).rowcount
            if added:core.log(c,actor,t,'visitor_created',nonce=actor)
            if route.path=='/demo/seed':
                seed(c,t);result=core.snapshot(c,actor,t)
            elif route.path=='/demo/receipt':
                from demo_ledger import record
                booking = c.execute("SELECT ref,price FROM bookings WHERE person=? AND sku IN ('RESET','TRAIN')", (actor,)).fetchone()
                kind = query['body'].get('kind')
                core.need(booking and kind in ('paid','refund'), 'Сначала открой заявку на сезон с учебной оплатой.')
                ref, price = booking
                op = 'demo-'+ref+'-'+kind
                c.commit()
                previous = c.execute('SELECT at FROM receipts WHERE id=?',(op,)).fetchone()
                record(c,ref,op,kind,price*100,previous[0] if previous else t,'direct')
                result=core.snapshot(c,actor,t)
            elif route.path=='/demo/renewal':
                order=core.season.state(c,actor,t)['booking']
                kind=query['body'].get('kind')
                core.need(order and order['sku']=='RESET','Сначала выбери RESET LEAGUE.')
                c.execute("""CREATE TABLE IF NOT EXISTS demo_renewals(
                    person TEXT PRIMARY KEY, ref TEXT UNIQUE NOT NULL, original_ref TEXT NOT NULL,
                    price INTEGER NOT NULL, paid_at REAL NOT NULL, refunded_at REAL)""")
                if kind=='paid':
                    core.need(order['paid_kopeks']>order['refunded_kopeks'],'Сначала подтверди учебную оплату первого сезона.')
                    c.execute('INSERT OR IGNORE INTO demo_renewals VALUES(?,?,?,?,?,NULL)',
                              (actor,'S2-'+core.ident(),order['ref'],core.season.OFFERS['RESET'][1],t))
                elif kind=='refund':
                    core.need(c.execute('SELECT 1 FROM demo_renewals WHERE person=?',(actor,)).fetchone(),'Сначала выбери второй сезон.')
                    c.execute('UPDATE demo_renewals SET refunded_at=COALESCE(refunded_at,?) WHERE person=?',(t,actor))
                else:raise ValueError('Неизвестная учебная операция.')
                result=core.snapshot(c,actor,t)
            elif route.path=='/api/me':
                result=core.snapshot(c,actor,t)
            elif route.path=='/api/action':
                data=query['body']
                verb,key=data['verb'],data['nonce']
                if verb in ('subscribe','unsubscribe'):
                    raise ValueError('Системные уведомления доступны в серверной версии.')
                old=core.one(c,'SELECT verb,result FROM requests WHERE person=? AND nonce=?',(actor,key))
                if old:
                    core.need(old['verb']==verb,'Код запроса занят.')
                    extra=json.loads(old['result'])
                else:
                    extra=core.operate(c,actor,verb,data,t)
                    c.execute('INSERT INTO requests VALUES(?,?,?,?)',(actor,key,verb,json.dumps(extra)))
                result={**core.snapshot(c,actor,t),'result':extra}
            elif route.path=='/api/invite':
                token=parse_qs(route.query).get('token',[''])[0]
                game=core.one(c,'SELECT g.*,p.name FROM games g JOIN people p ON p.id=g.host WHERE token=?',(token,))
                core.need(game,'Приглашение доступно в браузере, в котором создана игра.')
                core.log(c,actor,t,'invite_viewed',game['id'],nonce=game['id'])
                result={'mode':game['mode'],'name':game['name'],'open':core.joinable(c,game,t),'member':bool(core.one(c,'SELECT 1 FROM members WHERE game=? AND person=?',(game['id'],actor))),'proposed':game['proposed'],'reward':core.choices.reward(c,game['id']) if game['mode']=='duel' else ''}
            else:raise ValueError('Этот режим доступен на сервере RITM.')
            if isinstance(result,dict) and "profile" in result:
                result["home_plan"]=home_plan(c,actor,t)
                if c.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='demo_renewals'").fetchone():
                    renewal=c.execute('SELECT ref,price,refunded_at FROM demo_renewals WHERE person=?',(actor,)).fetchone()
                    result['demo_renewal']=dict(renewal) if renewal else None
    return json.dumps(result,ensure_ascii=False)
def answer(raw):
    try:return json.dumps({'value':json.loads(request(raw))},ensure_ascii=False)
    except (ValueError,TypeError,KeyError) as e:return json.dumps({'error':str(e)},ensure_ascii=False)

