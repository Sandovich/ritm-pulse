"""Opt-in Web Push. Keep the signing key in the operator environment."""
import base64
import json
import os
import sqlite3
import time
from urllib.parse import urlsplit

SCHEMA="""
CREATE TABLE IF NOT EXISTS push_subs(endpoint TEXT PRIMARY KEY,person TEXT NOT NULL REFERENCES people,subscription TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS push_queue(action TEXT REFERENCES actions,recipient TEXT REFERENCES people, endpoint TEXT REFERENCES push_subs ON DELETE CASCADE,attempts INTEGER NOT NULL DEFAULT 0,next_at REAL NOT NULL, PRIMARY KEY(action,endpoint));
"""
def public_key():
    pem=os.getenv('RITM_VAPID_PEM');sub=os.getenv('RITM_PUSH_CONTACT','')
    if not pem or not sub.startswith(('mailto:','https://')):return ''
    try:
        import pywebpush
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.primitives.asymmetric import ec
        key=serialization.load_pem_private_key(pem.encode(),password=None)
        if not isinstance(key,ec.EllipticCurvePrivateKey) or key.curve.name!='secp256r1':return ''
        raw=key.public_key().public_bytes(serialization.Encoding.X962,serialization.PublicFormat.UncompressedPoint)
        return base64.urlsafe_b64encode(raw).decode().rstrip('=')
    except (ValueError,TypeError,ImportError):return ''
def validate(sub):
    if not isinstance(sub,dict):return False
    url=sub.get('endpoint','');keys=sub.get('keys',{})
    if not isinstance(url,str) or len(url)>1800 or not isinstance(keys,dict):return False
    s=urlsplit(url);host=s.hostname or ''
    if s.scheme!='https' or s.port not in (443,None) or s.username or s.password or s.fragment or not s.path.strip('/'):return False
    if not (host in ('fcm.googleapis.com','push.apple.com','web.push.apple.com','updates.push.services.mozilla.com') or host.endswith('.push.apple.com') or host.endswith('.push.services.mozilla.com')):return False
    try:
        def size(k):return len(base64.b64decode(keys[k]+'===' ,altchars=b'-_',validate=False))
        return size('p256dh')==65 and size('auth')==16
    except (KeyError,ValueError,TypeError):return False
def subscribe(c,p,sub):
    if not public_key() or not validate(sub):raise ValueError('Подписка недоступна. Проверьте настройку Web Push.')
    endpoint=sub['endpoint']
    old=c.execute('SELECT person FROM push_subs WHERE endpoint=?',(endpoint,)).fetchone()
    if old and old[0]!=p:raise ValueError('Отмените предыдущую подписку на этом устройстве.')
    c.execute('INSERT INTO push_subs VALUES(?,?,?) ON CONFLICT(endpoint) DO UPDATE SET subscription=excluded.subscription',(endpoint,p,json.dumps(sub)))
def enqueue(c,actor,aid,t):
    c.execute("""INSERT OR IGNORE INTO push_queue(action,recipient,endpoint,next_at)
    SELECT ?,m.person,s.endpoint,? FROM members owner JOIN games g ON g.id=owner.game AND g.mode='circle'
    JOIN members m ON m.game=g.id JOIN push_subs s ON s.person=m.person
    WHERE owner.person=? AND m.person<>? AND m.joined<=? AND owner.joined<=?""",(aid,t,actor,actor,t,t))
def can_send(c,aid,recipient,t):
    return c.execute("""SELECT 1 FROM actions a JOIN members owner ON owner.person=a.person
    JOIN games g ON g.id=owner.game AND g.mode='circle' JOIN members m ON m.game=g.id
    WHERE a.id=? AND m.person=? AND a.at>? AND a.at>=m.joined AND a.at>=owner.joined
    AND NOT EXISTS(SELECT 1 FROM hidden_actions h WHERE h.action=a.id)""",(aid,recipient,t-86400)).fetchone() is not None
def deliver(sub):
    from pywebpush import webpush
    from py_vapid import Vapid02
    signer=Vapid02.from_pem(os.environ['RITM_VAPID_PEM'].encode())
    webpush(subscription_info=sub,data=json.dumps({'type':'pulse'}),vapid_private_key=signer,
            vapid_claims={'sub':os.environ['RITM_PUSH_CONTACT']},ttl=3600,timeout=7)
def drain(c,t,send=deliver):
    row=c.execute("""SELECT q.action,q.recipient,q.endpoint,q.attempts,s.subscription FROM push_queue q
        JOIN push_subs s USING(endpoint) WHERE next_at<=? ORDER BY next_at LIMIT 1""",(t,)).fetchone()
    if not row:return False
    aid,p,endpoint,tries,sub=row
    if can_send(c,aid,p,t):
        try:send(json.loads(sub))
        except Exception as exc:
            code=getattr(getattr(exc,'response',None),'status_code',None)
            if code in (404,410):c.execute('DELETE FROM push_subs WHERE endpoint=?',(endpoint,))
            elif tries<3:
                c.execute('UPDATE push_queue SET attempts=attempts+1,next_at=? WHERE action=? AND endpoint=?',(t+30*(2**tries),aid,endpoint));return True
    c.execute('DELETE FROM push_queue WHERE action=? AND endpoint=?',(aid,endpoint));return True
def run(db_path):
    with sqlite3.connect(db_path,timeout=12) as c:
        c.execute('PRAGMA foreign_keys=ON')
        while True:
            try:
                with c:processed=drain(c,time.time())
                if not processed:time.sleep(2)
            except sqlite3.OperationalError:time.sleep(2)

