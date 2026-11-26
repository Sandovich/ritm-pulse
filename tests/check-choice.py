"""Regression tests for private invitations, guest role swaps and the duel reward."""
import http.cookiejar
import importlib.util
import json
import secrets
import sqlite3
import sys
import tempfile
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import HTTPCookieProcessor, Request, build_opener

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'web'))
import notifications
import server

T = 1795640000

class ChoiceTest(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.db.row_factory = sqlite3.Row
        self.db.execute('PRAGMA foreign_keys=ON')
        self.db.executescript(server.SQL)
        with self.db:
            for person, goal in [('a','Прогулки'),('b',''),('c','')]:
                self.db.execute('INSERT INTO people(id,session_hash,name,goal) VALUES(?,?,?,?)',(person,person,person,goal))

    def tearDown(self):
        self.assertFalse(self.db.execute('PRAGMA foreign_key_check').fetchall())
        self.db.close()

    def op(self, person, verb, at=T, **body):
        with self.db:
            return server.operate(self.db,person,verb,body,at)

    def make(self, owner='a', at=T, **extra):
        return self.op(owner,'choice_create',at,options=['walk','food'],minutes=10,**extra)['choice']

    def snap(self, p, at=T):
        return server.snapshot(self.db,p,at)

    def count(self, table):
        return self.db.execute(f'SELECT count(*) FROM {table}').fetchone()[0]

    def test_complete_guest_swap_and_push(self):
        first = self.make()
        cid, token = first['id'], first['token']
        self.assertNotEqual(cid,token)
        invited = self.op('b','choice_open',token=token)['choice']
        self.assertEqual(invited['role'],'guest')
        self.assertIsNone(invited['owner'])
        self.assertNotIn('token',invited)
        self.assertEqual(self.snap('b')['choices'],[])
        self.op('a','choice_share',id=cid,method='copy')
        self.op('a','choice_share',id=cid,method='share')
        self.op('b','choice_vote',T+10,token=token,option='walk')
        self.op('b','choice_vote',T+11,token=token,option='walk')
        for who, verb, payload in [('b','choice_vote',{'token':token,'option':'food'}),
                                    ('c','choice_open',{'token':token}),
                                    ('c','choice_vote',{'token':token,'option':'walk'}),
                                    ('b','choice_complete',{'id':cid}),
                                    ('c','choice_complete',{'id':cid})]:
            with self.assertRaises(ValueError):
                self.op(who,verb,T+12,**payload)
        self.assertEqual(self.op('b','choice_open',T+12,token=token)['choice']['role'],'voter')
        self.assertEqual(self.op('a','choice_open',T+12,token=token)['choice']['role'],'owner')
        self.db.execute("INSERT INTO push_subs VALUES('b-device','b','{}')")
        self.db.execute("INSERT INTO push_subs VALUES('c-device','c','{}')")
        # The owner may have already recorded this personal action normally following the vote.
        self.op('a','done',T+15,kind='walk',task='walk',minutes=10)
        self.op('a','choice_complete',T+20,id=cid)
        self.op('a','choice_complete',T+30,id=cid)
        self.assertEqual(self.count('actions'),1)
        self.assertEqual(self.count('hidden_actions'),1)
        self.assertEqual(self.count('choice_push_queue'),1)
        self.assertEqual(self.count('push_queue'),0)
        sent=[]
        self.assertTrue(notifications.drain(self.db,T+32,lambda sub,msg:sent.append(msg)))
        self.assertEqual(sent,[{'type':'choice','choice':cid}])
        self.assertEqual(self.snap('b')['choices'][0]['completed'],T+20)
        self.assertEqual(self.snap('c')['choices'],[])
        with self.assertRaises(ValueError):
            self.make('c',T+40,parent=cid)
        child=self.op('b','choice_create',T+86400,options=['food','move'],minutes=5,parent=cid)['choice']
        self.assertEqual([x['id'] for x in child['options']],['food','move'])
        self.assertEqual(self.make('b',T+86401,parent=cid)['id'],child['id'])
        recipient=self.snap('a',T+86401)['choices'][0]
        self.assertEqual(recipient['token'],child['token'])
        with self.assertRaises(ValueError):
            self.op('c','choice_open',T+86402,token=child['token'])
        self.op('a','choice_vote',T+86404,token=child['token'],option='food')
        self.op('b','choice_complete',T+86405,id=child['id'])
        self.assertEqual(self.count('actions'),2)
        self.assertEqual(self.snap('b',T+86405)['actions'][0]['kind'],'food')
        events=self.db.execute("SELECT person,kind,game,nonce FROM events WHERE kind LIKE 'choice_%'").fetchall()
        self.assertTrue(all(e['game'] is None and e['nonce'] not in [token,child['token']] for e in events))
        self.assertEqual(sum(e['kind']=='choice_repeat_day' and e['person']=='b' for e in events),1)
        self.assertEqual(sum(e['kind']=='choice_swapped' for e in events),1)
        self.assertEqual(sum(e['kind']=='choice_completed' for e in events),2)
        self.assertEqual(sum(e['kind']=='choice_copied' for e in events),1)
        self.assertEqual(sum(e['kind']=='choice_shared' for e in events),1)

    def test_choice_requires_action_after_ballot(self):
        invite = self.make()
        self.op('a','done',T+2,kind='walk',task='walk',minutes=10)
        self.op('b','choice_vote',T+5,token=invite['token'],option='walk')
        with self.assertRaisesRegex(ValueError,'до выбора друга'):
            self.op('a','choice_complete',T+10,id=invite['id'])
        self.assertIsNone(self.snap('a',T+11)['choices'][0]['completed'])
        self.assertEqual(self.count('choice_push_queue'),0)

    def test_funnel_cutoff_swap_and_mature_pairs(self):
        first=self.make()
        self.op('a','choice_share',T+1,id=first['id'],method='copy')
        self.op('c','choice_open',T+2,token=first['token'])
        self.op('b','choice_open',T+3,token=first['token'])
        self.op('b','choice_vote',T+4,token=first['token'],option='walk')
        self.op('a','choice_complete',T+5,id=first['id'])
        same_day=self.make('b',T+6,parent=first['id'])
        self.op('a','choice_vote',T+7,token=same_day['token'],option='food')
        self.op('b','choice_complete',T+8,id=same_day['id'])
        another_day=self.make('a',T+86400)
        self.op('b','choice_vote',T+86401,token=another_day['token'],option='walk')
        self.op('a','choice_complete',T+86402,id=another_day['id'])
        unobserved=self.make('c',T+7*86400)
        self.op('a','choice_vote',T+7*86400+1,token=unobserved['token'],option='food')
        self.op('c','choice_complete',T+7*86400+2,id=unobserved['id'])
        module_path=Path(__file__).resolve().parents[1]/'analysis/choice-funnel.py'
        spec=importlib.util.spec_from_file_location('choice_funnel',module_path)
        funnel=importlib.util.module_from_spec(spec)
        spec.loader.exec_module(funnel)
        with tempfile.TemporaryDirectory() as temp:
            path=Path(temp)/'read-only.sqlite'
            copy=sqlite3.connect(path)
            try:
                self.db.backup(copy)
            finally:
                copy.close()
            early=funnel.compute(path,T,T+4)
            self.assertEqual(early['rounds']['first']['opened'],1)
            self.assertEqual(early['rounds']['first']['voted'],0)
            self.assertEqual(early['pairs']['first_completed_pairs'],0)
            after=funnel.compute(path,T,T+7*86400+6)
            self.assertEqual(after['pairs'],dict(first_completed_pairs=2,mature_pairs=1,returned_pairs=1))
            self.assertEqual(after['rounds']['first']['created'],2)
            self.assertEqual(after['rounds']['later']['created'],1)
            self.assertEqual(after['rounds']['swap']['created'],1)
            self.assertEqual(after['rounds']['first']['mature_votes'],1)
            later=funnel.compute(path,T+86400,T+15*86400)
            self.assertEqual(later['rounds']['later']['created'],1)
            self.assertEqual(later['pairs'],dict(first_completed_pairs=1,mature_pairs=1,returned_pairs=0))

    def test_expiry_boundaries_and_validation(self):
        for fields in [{'options':['walk','walk'],'minutes':10},{'options':['outside','walk'],'minutes':10},
                       {'options':['food','walk'],'minutes':True},{'options':[{},'walk'],'minutes':5}]:
            with self.assertRaises(ValueError):
                self.op('a','choice_create',**fields)
        first=self.make()
        with self.assertRaises(ValueError):
            self.op('a','choice_vote',token=first['token'],option='walk')
        with self.assertRaises(ValueError):
            self.op('a','choice_complete',id=first['id'])
        with self.assertRaises(ValueError):
            self.op('b','choice_open',T+86400,token=first['token'])
        with self.assertRaises(ValueError):
            self.op('b','choice_vote',T+86400,token=first['token'],option='walk')
        self.assertTrue(self.snap('a',T+86400)['choices'][0]['expired'])
        fresh=self.make()
        self.op('b','choice_vote',T+86399,token=fresh['token'],option='food')
        self.assertFalse(self.snap('a',T+86401)['choices'][0]['expired'])
        with self.assertRaises(ValueError):
            self.op('a','choice_complete',T+86399+86400,id=fresh['id'])
        with self.db:
            self.db.execute("INSERT INTO seasons VALUES(?,?,?,NULL,NULL,'')",('a',T,json.dumps({'adaptation':'Сначала согласовать с тренером'})))
        import choices
        self.assertNotIn('move',[x['id'] for x in choices.plan(self.db,'a')])
        with self.assertRaises(ValueError):
            self.op('a','choice_create',options=['move','walk'],minutes=5)

    def test_duel_reward_and_no_double_score(self):
        with self.assertRaises(ValueError):
            self.op('a','create',mode='duel',kind='walk',reward='500 рублей')
        with self.assertRaises(ValueError):
            self.op('a','create',mode='circle',kind='walk',reward='Кофе')
        self.assertEqual(self.count('games'),0)
        game=self.op('a','create',mode='duel',kind='walk',reward='Победитель выбирает фильм')['game']
        duel=self.snap('a')['games'][0]
        self.assertEqual(duel['reward'],'Победитель выбирает фильм')
        self.op('b','join',T+1,token=duel['token'],kind='walk')
        self.assertEqual(self.snap('b')['games'][0]['reward'],duel['reward'])
        first=self.make(at=T+2)
        self.op('b','choice_vote',T+3,token=first['token'],option='walk')
        self.op('a','done',T+4,kind='walk',task='walk',minutes=10,game=game)
        self.op('a','choice_complete',T+5,id=first['id'])
        self.assertEqual(self.count('actions'),1)
        self.assertEqual(self.count('marks'),1)
        other=self.make(at=T+6)
        self.op('b','choice_vote',T+7,token=other['token'],option='walk')
        with self.assertRaises(ValueError):
            self.op('a','choice_complete',T+8,id=other['id'])
        self.assertEqual(self.count('marks'),1)

class AnonymousRaceTest(unittest.TestCase):
    def test_real_guest_cookies_one_winning_vote_and_retry(self):
        with tempfile.TemporaryDirectory() as temp:
            db=str(Path(temp)/'pilot.sqlite')
            c=sqlite3.connect(db)
            c.executescript(server.SQL)
            c.close()
            srv=server.ThreadingHTTPServer(('127.0.0.1',0),server.Handler)
            srv.db=db
            thread=threading.Thread(target=srv.serve_forever,daemon=True)
            thread.start()
            try:
                url='http://%s:%s' % srv.server_address
                clients=[build_opener(HTTPCookieProcessor(http.cookiejar.CookieJar())) for _ in range(3)]
                for client in clients:
                    with client.open(url+'/api/me') as response:
                        self.assertIn('HttpOnly',response.headers['Set-Cookie'])
                def call(client,verb,nonce=None,**kwargs):
                    data=json.dumps(dict(verb=verb,nonce=nonce or secrets.token_hex(6),**kwargs)).encode()
                    req=Request(url+'/api/action',data=data,headers={'Content-Type':'application/json'})
                    try:
                        with client.open(req) as response:return response.status,json.load(response)
                    except HTTPError as err:
                        with err:return err.code,json.load(err)
                owner,left,right=clients
                args={'options':['walk','food'],'minutes':10}
                status,res=call(owner,'choice_create','same-nonce',**args)
                self.assertEqual(status,200)
                first=res['result']['choice']
                self.assertEqual(call(owner,'choice_create','same-nonce',**args)[1]['result']['choice']['id'],first['id'])
                with ThreadPoolExecutor(2) as pool:
                    requests=[pool.submit(call,client,'choice_vote',token=first['token'],option=pid)
                              for client,pid in [(left,'walk'),(right,'food')]]
                    self.assertEqual(sorted(r.result()[0] for r in requests),[200,400])
                self.assertEqual(call(owner,'choice_complete',id=first['id'])[0],200)
                call(owner,'profile',name='Тест',goal=server.GOALS[0],barrier=server.BARRIERS[0],program=server.PROGRAMS[0])
                status,res=call(owner,'create',mode='duel',kind='walk',reward='Кино в субботу')
                self.assertEqual(status,200)
                duel=res['games'][0]
                with right.open(url+'/api/invite?token='+duel['token']) as response:
                    self.assertEqual(json.load(response)['reward'],'Кино в субботу')
                script=Path(__file__).resolve().parents[1]/'analysis/import-social.py'
                spec=importlib.util.spec_from_file_location('import_social',script)
                importer=importlib.util.module_from_spec(spec)
                spec.loader.exec_module(importer)
                warehouse=str(Path(temp)/'analytics.sqlite')
                importer.sync(db,warehouse)
                connection=sqlite3.connect(warehouse)
                try:
                    self.assertTrue(connection.execute("SELECT 1 FROM people WHERE guest=1 AND channel='invite'").fetchone())
                    self.assertEqual(connection.execute("SELECT COUNT(*) FROM activity WHERE kind='choice_voted'").fetchone()[0],1)
                    self.assertFalse(connection.execute('PRAGMA foreign_key_check').fetchall())
                finally:
                    connection.close()
            finally:
                srv.shutdown()
                thread.join()
                srv.server_close()

if __name__=='__main__':
    unittest.main(verbosity=2)
