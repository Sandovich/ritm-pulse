"""Explicit, versioned sample data; this module is loaded only by the local Pages demo."""
from datetime import timedelta

import core

OWNER, LENA, MAX, MASHA = ('demo-owner','demo-friend','demo-max','demo-masha')


def profile(c, person, name, when):
    c.execute('INSERT OR IGNORE INTO people(id,session_hash) VALUES(?,?)',(person,person))
    if not c.execute('SELECT goal FROM people WHERE id=?',(person,)).fetchone()[0]:
        core.operate(c,person,'profile',dict(name=name,goal='Регулярное движение',barrier='Мало времени',program='Своя программа'),when)


def mark(c, person, kind, when, public=False):
    task=core.FOOD[0] if kind=='food' else kind
    core.operate(c,person,'done',dict(kind=kind,task=task,minutes=20,visibility='circle' if public else 'private'),when)


def seed(c,t):
    c.execute('CREATE TABLE IF NOT EXISTS demo_fixture(version INTEGER PRIMARY KEY)')
    c.execute('CREATE TABLE IF NOT EXISTS demo_home_plan(day TEXT, kind TEXT, PRIMARY KEY(day,kind))')
    versions={r[0] for r in c.execute('SELECT version FROM demo_fixture')}
    if 2 in versions:
        return
    start=t-8*86400
    for person,name in [(OWNER,'Саша'),(LENA,'Лена'),(MAX,'Макс'),(MASHA,'Маша')]:
        profile(c,person,name,start)
    # Existing demo histories, invitations, and departures are kept across this update.
    if 1 in versions:
        c.execute('INSERT INTO demo_fixture VALUES(2)')
        return
    for mode,members in [('circle',[(LENA,'walk'),(MAX,'food'),(MASHA,'move')]),('duel',[(LENA,'walk')])]:
        gid=core.operate(c,OWNER,'create',dict(mode=mode,kind='move'),start)['game']
        token=c.execute('SELECT token FROM games WHERE id=?',(gid,)).fetchone()[0]
        for i,(person,kind) in enumerate(members):
            core.operate(c,person,'join',dict(token=token,kind=kind),start+i+1)
    schedule = [('move','food'),('walk','food'),('move','food'),('walk','food'),('move',),('walk',),('food',)]
    for index,kinds in enumerate(schedule):
        when=t-(6-index)*86400
        for kind in kinds:
            c.execute('INSERT INTO demo_home_plan VALUES(?,?)',(str(core.day(when)),kind))
            if index<5:
                mark(c,OWNER,kind,when,True)
    mark(c,MAX,'food',t-3600,True)
    mark(c,LENA,'move',t-720,True)
    c.execute('INSERT INTO demo_fixture VALUES(2)')


def home_plan(c,actor,t):
    if actor!=OWNER or not c.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='demo_home_plan'").fetchone():
        return []
    today=core.day(t)
    # Fall back to the ordinary real weekly goal once this example week has ended.
    if not c.execute('SELECT 1 FROM demo_home_plan WHERE day=?',(str(today),)).fetchone():
        return []
    days={}
    for day,kind in c.execute('SELECT day,kind FROM demo_home_plan WHERE day>=? AND day<=? ORDER BY day,kind',(str(today-timedelta(days=6)),str(today))):
        days.setdefault(day,[]).append(kind)
    return [dict(date=day,kinds=kinds) for day,kinds in days.items()]
