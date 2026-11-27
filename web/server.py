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
import journey
import season
import notifications
import choices
# The HTTP and browser editions use the same domain rules.
from core import (SQL, now, day, ident, rows, one, Bad, need, log, joinable, snapshot, operate, MINUTES, FOOD, GOALS, BARRIERS, PROGRAMS)
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
        files={'/pilot':('app.html','text/html; charset=utf-8'),'/':('mobile.html','text/html; charset=utf-8'),'/app.js':('app.js','text/javascript; charset=utf-8'),'/season.js':('season.js','text/javascript; charset=utf-8'),'/sw.js':('sw.js','text/javascript; charset=utf-8'),'/manifest.webmanifest':('manifest.webmanifest','application/manifest+json'),'/icon.png':('icon.png','image/png'),'/icon512.png':('icon512.png','image/png')}
        if not write and (path.startswith('/assets/') or path in ('/athletic.css','/premium.css','/premium.js','/content.js') or path.startswith('/demo/')):
            from mimetypes import guess_type
            demo=path.startswith('/demo/')
            base=(ROOT.parent/'docs' if demo else ROOT).resolve()
            part=path[6:] if demo else path.lstrip('/')
            target=(base/(part or 'index.html')).resolve()
            if (path.startswith('/assets/') and not target.is_relative_to(base/'assets')) or not target.is_relative_to(base) or not target.is_file() or any(v.startswith('.') for v in target.relative_to(base).parts):
                self.respond(404,{});return
            self.respond(200,target.read_bytes(),guess_type(str(target))[0] or 'application/octet-stream');return
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
                log(c,who,t,'invite_viewed',g['id'],nonce=g['id']);v={'mode':g['mode'],'name':g['name'],'open':joinable(c,g,t),'member':bool(one(c,'SELECT 1 FROM members WHERE game=? AND person=?',(g['id'],who))),'proposed':g['proposed'],'reward':choices.reward(c,g['id']) if g['mode']=='duel' else ''}
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

