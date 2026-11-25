"""RITM PULSE. Local pilot on Python 3.10+, SQLite; no external services."""
import argparse
import sys
from collections import deque
from threading import Lock, Thread
import time
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import secrets
import sqlite3
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT))
import season
import notifications
MSK = timezone(timedelta(hours=3))
GOALS = ('Физическая форма','Регулярное движение','Питание','Прогулки')
BARRIERS = ('Мало времени','Меняется график','Сложно начать одному','Трудно решить, что приготовить')
PROGRAMS = ('Своя программа','Движение с тренером','Питание с нутрициологом')
FOOD = ('Кускус с нутом и огурцом','Паста с томатами и фасолью','Лаваш с хумусом и овощами','Гречка с грибами','Рис с горошком','Картофель с фасолью','Омлет с помидором')
KINDS = ('move','food','walk')
MINUTES = (5,10,15,20,30,60)
SQL = """
CREATE TABLE IF NOT EXISTS people(id TEXT PRIMARY KEY,session_hash TEXT UNIQUE NOT NULL,name TEXT NOT NULL DEFAULT '',goal TEXT NOT NULL DEFAULT '',barrier TEXT NOT NULL DEFAULT '',program TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS games(id TEXT PRIMARY KEY,token TEXT UNIQUE NOT NULL,mode TEXT NOT NULL,host TEXT NOT NULL REFERENCES people(id),created INTEGER NOT NULL,expires INTEGER NOT NULL,starts INTEGER,proposed INTEGER);
CREATE TABLE IF NOT EXISTS members(game TEXT REFERENCES games(id),person TEXT REFERENCES people(id),kind TEXT NOT NULL,joined INTEGER NOT NULL,PRIMARY KEY(game,person));
CREATE TABLE IF NOT EXISTS actions(id TEXT PRIMARY KEY,person TEXT REFERENCES people(id),day TEXT NOT NULL,kind TEXT NOT NULL,minutes INTEGER NOT NULL,at INTEGER NOT NULL,variant TEXT NOT NULL,task TEXT NOT NULL,label TEXT NOT NULL,UNIQUE(person,day,task));
CREATE TABLE IF NOT EXISTS marks(game TEXT REFERENCES games(id),person TEXT REFERENCES people(id),day TEXT NOT NULL,action TEXT REFERENCES actions(id),PRIMARY KEY(game,person,day));
CREATE TABLE IF NOT EXISTS replies(game TEXT REFERENCES games(id),source_action TEXT REFERENCES actions(id),person TEXT REFERENCES people(id),reply_action TEXT REFERENCES actions(id),PRIMARY KEY(game,source_action,person));
CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY,person TEXT REFERENCES people(id),at INTEGER NOT NULL,kind TEXT NOT NULL,game TEXT,minutes INTEGER,nonce TEXT,UNIQUE(person,kind,nonce));
CREATE TABLE IF NOT EXISTS requests(person TEXT NOT NULL,nonce TEXT NOT NULL,verb TEXT NOT NULL,result TEXT NOT NULL,PRIMARY KEY(person,nonce));
"""
SQL += season.SCHEMA + notifications.SCHEMA

def now(): return datetime.now(timezone.utc).timestamp()
def day(at): return datetime.fromtimestamp(at,MSK).date()
def ident(): return secrets.token_urlsafe(16)
def rows(c,q,p=()): return [dict(x) for x in c.execute(q,p)]
def one(c,q,p=()): return c.execute(q,p).fetchone()
class Bad(ValueError): pass
def need(ok,msg):
    if not ok: raise Bad(msg)
def enum(v,options,label):
    need(v in options,label);return v
def log(c,who,t,kind,game=None,minutes=None,nonce=None):
    c.execute('INSERT OR IGNORE INTO events(person,at,kind,game,minutes,nonce) VALUES(?,?,?,?,?,?)',(who,t,kind,game,minutes,nonce))
def joinable(c,g,t):
    count=one(c,'SELECT COUNT(*) FROM members WHERE game=?',(g['id'],))[0]
    return t<g['expires'] and 0<count<(4 if g['mode']=='circle' else 2)
def live(g,t):
    if g['mode']=='circle':return True
    if g['mode']=='relay':return t<g['expires']
    return g['starts'] is not None and 0<=(day(t)-day(g['starts'])).days<7

def snapshot(c,who,t):
    profile=dict(one(c,'SELECT id,name,goal,barrier,program FROM people WHERE id=?',(who,)))
    games=rows(c,'SELECT g.* FROM games g JOIN members m ON m.game=g.id WHERE m.person=? ORDER BY g.created DESC,g.rowid DESC',(who,))
    circles=[]
    for g in games:
        g['participants']=rows(c,'SELECT p.id,p.name,m.kind FROM members m JOIN people p ON p.id=m.person WHERE game=? ORDER BY m.rowid',(g['id'],))
        marks=rows(c,'SELECT person,day FROM marks WHERE game=?',(g['id'],))
        for m in g['participants']:
            m['days']=[a['day'] for a in marks if a['person']==m['id']]
            if g['mode']=='circle':
                started=one(c,'SELECT joined FROM members WHERE game=? AND person=?',(g['id'],m['id']))[0]
                # Only activity following this person's opt-in to this circle.
                viewer_joined=one(c,'SELECT joined FROM members WHERE game=? AND person=?',(g['id'],who))[0]
                shared_since=max(started,viewer_joined)
                visible='NOT EXISTS (SELECT 1 FROM hidden_actions h WHERE h.action=actions.id)'
                a=one(c,'SELECT COUNT(DISTINCT kind) FROM actions WHERE person=? AND day=? AND at>=? AND '+visible,(m['id'],str(day(t)),shared_since))
                latest=one(c,'SELECT id,kind,at FROM actions WHERE person=? AND at>=? AND at>? AND '+visible+' ORDER BY at DESC LIMIT 1',(m['id'],shared_since,t-86400))
                source=latest['id'] if latest else None
                answered=bool(source and one(c,'SELECT 1 FROM replies WHERE game=? AND source_action=? AND person=?',(g['id'],source,who)))
                for_you=bool(source and one(c,'SELECT 1 FROM replies r JOIN actions a ON a.id=r.source_action WHERE r.game=? AND r.reply_action=? AND a.person=?',(g['id'],source,who)))
                circles.append({'for_you':for_you,'game':g['id'],'person':m['id'],'name':m['name'],'count':a[0],'at':latest['at'] if latest else None,'source':source,'kind':latest['kind'] if latest else None,'answered':answered})
        g['active']=live(g,t);g['invite_open']=joinable(c,g,t)
        if who!=g['host']:g.pop('token')
    return dict(**season.state(c,who,t),push_key=notifications.public_key(),profile=profile,day=str(day(t)),server_time=t,games=games,pulse=circles,
       actions=rows(c,'SELECT id,kind,minutes,task,label,at,NOT EXISTS(SELECT 1 FROM hidden_actions h WHERE h.action=actions.id) AS shared FROM actions WHERE person=? AND day=? ORDER BY at',(who,str(day(t)))))
def operate(c,who,verb,b,t):
    if verb in ('allocate','exposure','season','checkin','book'):return season.operate(c,who,verb,b,t)
    if verb=='subscribe':notifications.subscribe(c,who,b.get('subscription'));return {}
    if verb=='unsubscribe':
        c.execute('DELETE FROM push_subs WHERE person=? AND endpoint=?',(who,b.get('endpoint','')));return {}
    if verb=='hide':
        aid=b.get('action')
        need(one(c,'SELECT 1 FROM actions WHERE id=? AND person=?',(aid,who)),'Дело недоступно.')
        c.execute('INSERT OR IGNORE INTO hidden_actions VALUES(?)',(aid,));c.execute('DELETE FROM push_queue WHERE action=?',(aid,));return {}
    if verb=='leave':
        gid=b.get('game');g=one(c,"SELECT g.* FROM games g JOIN members m ON g.id=m.game WHERE g.id=? AND m.person=? AND g.mode='circle'",(gid,who))
        need(g,'Круг недоступен.');c.execute('DELETE FROM members WHERE game=? AND person=?',(gid,who))
        nxt=one(c,'SELECT person FROM members WHERE game=? ORDER BY joined LIMIT 1',(gid,))
        if who==g['host']:
            c.execute('UPDATE games SET host=?,token=?,expires=? WHERE id=?',(nxt[0] if nxt else who,ident(),t+86400 if nxt else t,gid))
        log(c,who,t,'circle_left',gid);return {}
    if verb in ('done','create'):
        need(one(c,'SELECT goal FROM people WHERE id=?',(who,))[0] or one(c,'SELECT 1 FROM members WHERE person=?',(who,)), 'Сначала настройте личный план в профиле или примите приглашение друга.')
    if verb=='profile':
        name=str(b.get('name','')).strip();need(1<=len(name)<=30,'Имя должно содержать от 1 до 30 знаков.')
        c.execute('UPDATE people SET name=?,goal=?,barrier=?,program=? WHERE id=?',(name,enum(b.get('goal'),GOALS,'Выберите цель.'),enum(b.get('barrier'),BARRIERS,'Выберите препятствие.'),enum(b.get('program'),PROGRAMS,'Выберите программу.'),who));return {}
    if verb=='create':
        mode=enum(b.get('mode'),('relay','duel','circle'),'Неизвестный режим.')
        kind=enum(b.get('kind'),KINDS,'Выберите план.')
        slot=b.get('proposed')
        if slot is not None:need(type(slot)==int and t<slot<=t+7*86400,'Выберите будущее время в пределах недели.')
        if mode=='relay':
            src=one(c,'SELECT id,minutes FROM actions WHERE person=? AND day=? AND kind=? ORDER BY at DESC LIMIT 1',(who,str(day(t)),kind))
            need(src is not None,'Сначала выполните своё действие этого вида.')
        gid,token=ident(),ident();c.execute('INSERT INTO games VALUES(?,?,?,?,?,?,?,?)',(gid,token,mode,who,t,t+86400,None,slot))
        c.execute('INSERT INTO members VALUES(?,?,?,?)',(gid,who,kind,t))
        if mode=='relay':c.execute('INSERT INTO marks VALUES(?,?,?,?)',(gid,who,str(day(t)),src['id']))
        log(c,who,t,mode+'_offered',gid,nonce=gid);return {'game':gid}
    if verb=='join':
        g=one(c,'SELECT * FROM games WHERE token=?',(str(b.get('token','')),));need(g is not None,'Приглашение не найдено.')
        if one(c,'SELECT 1 FROM members WHERE game=? AND person=?',(g['id'],who)):return {'game':g['id']}
        need(joinable(c,g,t),'Срок приглашения истёк или все места заняты.')
        k=enum(b.get('kind'),KINDS,'Выберите личное дело.')
        c.execute('INSERT INTO members VALUES(?,?,?,?)',(g['id'],who,k,t))
        if g['mode']=='duel':c.execute('UPDATE games SET starts=? WHERE id=?',(t,g['id']))
        log(c,who,t,'guest_joined',g['id'],nonce=g['id']);return {'game':g['id']}
    if verb=='decline':
        g=one(c,'SELECT id FROM games WHERE token=?',(str(b.get('token','')),));need(g,'Приглашение не найдено.')
        log(c,who,t,'guest_declined',g['id'],nonce=g['id']);return {}
    if verb=='done':
        kind=enum(b.get('kind'),KINDS,'Выберите вид действия.'); minutes=enum(b.get('minutes'),MINUTES,'Выберите время.')
        variant=enum(b.get('variant','original'),('original','alternative'),'Проверьте вариант.')
        task=b.get('task','');need(isinstance(task,str) and (task in ('move','walk') if kind!='food' else task in FOOD) and (kind=='food' or task==kind),'Выберите предложенное действие.')
        gref=b.get('game')
        if gref:
            g=one(c,'SELECT g.*,m.kind AS mykind FROM games g JOIN members m ON g.id=m.game WHERE g.id=? AND m.person=?',(gref,who))
            need(g is not None and live(g,t) and (g['mode']=='circle' or g['mykind']==kind),'Срок действия вышел или выбран другой личный план.')
        visibility=enum(b.get('visibility','private'),('private','circle'),'Выберите видимость.')
        impulse=b.get('source')
        if impulse:
            peer=one(c,'SELECT a.person,a.at FROM actions a JOIN members m ON m.person=a.person JOIN members viewer ON viewer.game=m.game AND viewer.person=? WHERE m.game=? AND a.id=? AND a.at>=MAX(m.joined,viewer.joined) AND a.at>? AND NOT EXISTS(SELECT 1 FROM hidden_actions h WHERE h.action=a.id)',(who,gref,impulse,t-86400))
            need(visibility=='circle' and gref and g['mode']=='circle' and peer and peer['person']!=who,'Этот импульс недоступен.')
        # Identical daily task counts once even if two tabs submit it.
        key='daily-food' if kind=='food' else kind
        prior=one(c,'SELECT * FROM actions WHERE person=? AND day=? AND task=?',(who,str(day(t)),key))
        if gref and g['mode']=='relay' and one(c,'SELECT 1 FROM marks WHERE game=? AND person=?',(gref,who)):
            return {'action':one(c,'SELECT action FROM marks WHERE game=? AND person=?',(gref,who))[0]}
        if prior:
            aid=prior['id']; actual=prior['at']; logged_minutes=prior['minutes']
            if gref and (actual<g['created'] or (g['starts'] and actual<g['starts']) or actual<one(c,'SELECT joined FROM members WHERE game=? AND person=?',(gref,who))[0]):
                raise Bad('Это дело уже было отмечено до вступления. Выберите другое дело при входе или вернитесь завтра, если игра ещё идёт.')
        else:
            aid=ident();actual=t;logged_minutes=minutes
            c.execute('INSERT INTO actions VALUES(?,?,?,?,?,?,?,?,?)',(aid,who,str(day(t)),kind,minutes,t,variant,key,task))
            if visibility=='private':c.execute('INSERT INTO hidden_actions VALUES(?)',(aid,))
            else:notifications.enqueue(c,who,aid,t)
            log(c,who,t,'food_action_completed' if kind=='food' else 'action_completed',minutes=minutes,nonce=aid)
        if impulse:
            need(not one(c,'SELECT 1 FROM hidden_actions WHERE action=?',(aid,)),'Дело сохранено лично.')
            consumed=one(c,'SELECT game,source_action FROM replies WHERE reply_action=?',(aid,))
            need(not consumed or (consumed['game']==gref and consumed['source_action']==impulse),'Это действие уже использовано для другого ответа.')
            need(actual>=peer['at'],'Вы уже отметили это дело до импульса. Выберите другое дело.')
            fresh=c.execute('INSERT OR IGNORE INTO replies VALUES(?,?,?,?)',(gref,impulse,who,aid)).rowcount
            if fresh:log(c,who,t,'pulse_answered',gref,logged_minutes,impulse)
        for g in rows(c,'SELECT g.*,m.joined,m.kind FROM games g JOIN members m ON g.id=m.game WHERE m.person=? AND m.kind=?',(who,kind)):
            if not live(g,t) or actual<g['joined'] or (g['starts'] and actual<g['starts']):continue
            if (g['mode']=='duel' and (gref==g['id'] or not one(c,'SELECT 1 FROM hidden_actions WHERE action=?',(aid,)))) or (g['mode']=='relay' and g['id']==gref and who!=g['host']):
                n=c.execute('INSERT OR IGNORE INTO marks VALUES(?,?,?,?)',(g['id'],who,str(day(t)),aid)).rowcount
                if n:log(c,who,t,g['mode']+'_completed',g['id'],logged_minutes,g['id']+str(day(t)))
        return {'action':aid}
    raise Bad('Неизвестная операция.')

class RateLimit:
    def __init__(self):
        self.lock=Lock()
        self.buckets={}
    def allow(self,ip,category):
        now=time.monotonic();key=(ip,category)
        with self.lock:
            if len(self.buckets)>=2048:
                self.buckets={k:q for k,q in self.buckets.items() if q and q[-1]>now-60}
                if key not in self.buckets and len(self.buckets)>=2048:return False
            q=self.buckets.setdefault(key,deque())
            while q and q[0]<=now-60:q.popleft()
            if len(q)>={'read':600,'write':180,'recovery':6}[category]:return False
            q.append(now);return True

class Handler(BaseHTTPRequestHandler):
    limits=RateLimit()
    def log_message(self,*args): pass
    def respond(self,status,v,typ='application/json; charset=utf-8',cookie=None):
        raw=v if isinstance(v,bytes) else json.dumps(v,ensure_ascii=False).encode()
        self.send_response(status); self.send_header('Content-Type',typ);self.send_header('Content-Length',str(len(raw)));self.send_header('Cache-Control','no-store');self.send_header('Referrer-Policy','no-referrer')
        if cookie:self.send_header('Set-Cookie','ritm_session='+cookie+'; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000')
        self.end_headers();self.wfile.write(raw)
    def dispatch(self,write):
        path=urlsplit(self.path).path
        category='recovery' if path.startswith('/api/recovery/') else 'write' if write else 'read'
        if not self.limits.allow(self.client_address[0],category):self.respond(429,{'error':'Слишком частые запросы. Попробуйте через минуту.'});return
        files={'/':('app.html','text/html; charset=utf-8'),'/app.js':('app.js','text/javascript; charset=utf-8'),'/season.js':('season.js','text/javascript; charset=utf-8'),'/sw.js':('sw.js','text/javascript; charset=utf-8'),'/manifest.webmanifest':('manifest.webmanifest','application/manifest+json'),'/icon.png':('icon.png','image/png'),'/icon512.png':('icon512.png','image/png')}
        if not write and path in files:
            name,typ=files[path];self.respond(200,(ROOT/name).read_bytes(),typ);return
        if (write and path not in ('/api/action','/api/recovery/create','/api/recovery/restore')) or (not write and path not in ('/api/me','/api/invite')):self.respond(404,{});return
        c=sqlite3.connect(self.server.db,timeout=8);c.row_factory=sqlite3.Row;c.execute('PRAGMA foreign_keys=ON')
        try:
            c.execute('BEGIN IMMEDIATE');t=now();jar=SimpleCookie();jar.load(self.headers.get('Cookie',''));val=jar.get('ritm_session');digest=sha256(val.value.encode()).hexdigest() if val else ''
            user=one(c,'SELECT id FROM people WHERE session_hash=?',(digest,));cookie=None
            if user:who=user[0]
            else:
                cookie=secrets.token_urlsafe(32);who=ident();c.execute('INSERT INTO people(id,session_hash) VALUES(?,?)',(who,sha256(cookie.encode()).hexdigest()));log(c,who,t,'visitor_created',nonce=who)
            if write:
                need(self.headers.get_content_type()=='application/json','Ожидается JSON.'); origin=self.headers.get('Origin');need(not origin or urlsplit(origin).netloc==self.headers.get('Host'),'Источник не совпадает.')
                length=int(self.headers.get('Content-Length','0'));need(0<length<=8192,'Размер запроса вне допустимого.')
                b=json.loads(self.rfile.read(length));need(isinstance(b,dict),'Ожидается объект.');verb=b.get('verb');key=b.get('nonce');need(isinstance(key,str) and 4<=len(key)<=100,'Нужен идентификатор запроса.')
                if path.startswith('/api/recovery/'):
                    if path.endswith('create'):
                        code=secrets.token_urlsafe(24);c.execute('INSERT OR REPLACE INTO recovery VALUES(?,?)',(who,sha256(code.encode()).hexdigest()))
                        c.commit();self.respond(200,{'code':code},cookie=cookie);return
                    code=b.get('code','');need(isinstance(code,str) and len(code)<=100,'Проверьте код.')
                    row=one(c,'SELECT person FROM recovery WHERE digest=?',(sha256(code.strip().encode()).hexdigest(),));need(row,'Код недействителен или уже использован.')
                    who=row[0];cookie=secrets.token_urlsafe(32);c.execute('DELETE FROM recovery WHERE person=?',(who,));c.execute('DELETE FROM push_subs WHERE person=?',(who,))
                    c.execute('UPDATE people SET session_hash=? WHERE id=?',(sha256(cookie.encode()).hexdigest(),who));c.commit();self.respond(200,{'ok':True},cookie=cookie);return
                saved=one(c,'SELECT verb,result FROM requests WHERE person=? AND nonce=?',(who,key))
                if saved:need(verb==saved[0],'Идентификатор занят.');extra=json.loads(saved[1])
                else:
                    extra=operate(c,who,verb,b,t); c.execute('INSERT INTO requests VALUES(?,?,?,?)',(who,key,verb,json.dumps(extra)))
                v={**snapshot(c,who,t),'result':extra}
            elif path=='/api/invite':
                from urllib.parse import parse_qs
                token=parse_qs(urlsplit(self.path).query).get('token',[''])[0]
                g=one(c,'SELECT g.*,p.name FROM games g JOIN people p ON p.id=g.host WHERE token=?',(token,));need(g,'Приглашение не найдено.')
                log(c,who,t,'invite_viewed',g['id'],nonce=g['id']);v={'mode':g['mode'],'name':g['name'],'open':joinable(c,g,t),'member':bool(one(c,'SELECT 1 FROM members WHERE game=? AND person=?',(g['id'],who))),'proposed':g['proposed']}
            else: v=snapshot(c,who,t)
            c.commit();self.respond(200,v,cookie=cookie)
        except (ValueError,TypeError) as e:c.rollback();self.respond(400,{'error':str(e)})
        finally:c.close()
    def do_GET(self):self.dispatch(False)
    def do_POST(self):self.dispatch(True)
if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--host',default='127.0.0.1');ap.add_argument('--port',default=8765,type=int);ap.add_argument('--db',default=str(ROOT/'pilot-local.sqlite'));ap.add_argument('--expert-report',action='store_true');args=ap.parse_args()
    with sqlite3.connect(args.db) as db:
        db.executescript(SQL)
        if args.expert_report:
            for row in db.execute('SELECT kind, COUNT(*), COUNT(DISTINCT person) FROM events GROUP BY kind ORDER BY kind'): print(*row,sep=' | ')
    if not args.expert_report:
        srv=ThreadingHTTPServer((args.host,args.port),Handler);srv.db=args.db
        if notifications.public_key():Thread(target=notifications.run,args=(args.db,),daemon=True).start()
        print('RITM listening on',srv.server_address,flush=True);srv.serve_forever()

