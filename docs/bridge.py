"""Adapter from local browser storage to the application's own rules."""
import json
import sqlite3
from contextlib import closing
from urllib.parse import urlsplit, parse_qs
import core
from fixture import seed

def request(raw):
    query=json.loads(raw)
    route=urlsplit(query['path'])
    actor='demo-'+('friend' if query['actor']=='friend' else 'owner')
    t=core.now()
    with closing(sqlite3.connect('/device.sqlite')) as c:
        c.row_factory=sqlite3.Row
        c.execute('PRAGMA foreign_keys=ON')
        c.executescript(core.SQL)
        with c:
            added=c.execute('INSERT OR IGNORE INTO people(id,session_hash,name) VALUES(?,?,?)',(actor,actor,'Друг' if actor.endswith('friend') else '')).rowcount
            if added:core.log(c,actor,t,'visitor_created',nonce=actor)
            if route.path=='/demo/seed':
                seed(c,t);result={'ok':True}
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
                result={'mode':game['mode'],'name':game['name'],'open':core.joinable(c,game,t),'member':bool(core.one(c,'SELECT 1 FROM members WHERE game=? AND person=?',(game['id'],actor))),'proposed':game['proposed']}
            else:raise ValueError('Этот режим доступен на сервере RITM.')
    return json.dumps(result,ensure_ascii=False)
def answer(raw):
    try:return json.dumps({'value':json.loads(request(raw))},ensure_ascii=False)
    except (ValueError,TypeError,KeyError) as e:return json.dumps({'error':str(e)},ensure_ascii=False)

