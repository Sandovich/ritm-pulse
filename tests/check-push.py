"""Подпись и шифрование Web Push. HTTP заменён локальной проверкой пакета."""
import base64,os,sqlite3,sys,time
from pathlib import Path
from unittest.mock import patch
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from requests import Response
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'web'))
import notifications,server
def b64(s):return base64.urlsafe_b64encode(s).decode().rstrip('=')
sender=ec.generate_private_key(ec.SECP256R1())
pem=sender.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption()).decode()
receiver=ec.generate_private_key(ec.SECP256R1()).public_key()
sub={'endpoint':'https://fcm.googleapis.com/fcm/send/local-fixture','keys':{'p256dh':b64(receiver.public_bytes(serialization.Encoding.X962,serialization.PublicFormat.UncompressedPoint)),'auth':b64(os.urandom(16))}}
c=sqlite3.connect(':memory:');c.row_factory=sqlite3.Row;c.executescript(server.SQL)
for p in ('a','b'):c.execute('INSERT INTO people(id,session_hash,goal) VALUES(?,?,?)',(p,p,'Питание'))
t=time.time();gid=server.operate(c,'a','create',{'mode':'circle','kind':'move'},t)['game']
tok=c.execute('SELECT token FROM games').fetchone()[0];server.operate(c,'b','join',{'token':tok,'kind':'move'},t)
with patch.dict(os.environ,{'RITM_VAPID_PEM':pem,'RITM_PUSH_CONTACT':'mailto:qa@example.org'}):
    assert notifications.public_key()
    notifications.subscribe(c,'b',sub)
    server.operate(c,'a','done',{'kind':'move','minutes':10,'task':'move','visibility':'circle'},t+1)
    assert c.execute('SELECT COUNT(*) FROM push_queue').fetchone()[0]==1
    response=Response();response.status_code=201;response._content=b''
    with patch('requests.sessions.Session.request',return_value=response) as net:
        notifications.drain(c,t+2)
        assert net.call_count==1
        params=net.call_args.kwargs; headers={k.lower():v for k,v in params['headers'].items()}
        assert 'vapid' in headers['authorization'].lower() and headers['content-encoding']=='aes128gcm' and b'pulse' not in params['data']
    assert c.execute('SELECT COUNT(*) FROM push_queue').fetchone()[0]==0
    x=server.operate(c,'a','done',{'kind':'walk','minutes':10,'task':'walk','visibility':'circle'},t+3)
    server.operate(c,'a','hide',{'action':x['action']},t+4)
    assert not notifications.drain(c,t+5,lambda _:(_ for _ in ()).throw(AssertionError()))
print('OK • signed and encrypted Web Push, consent, queue, privacy. No remote delivery.')
