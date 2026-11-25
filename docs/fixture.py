import core

def seed(c,t):
    c.execute('CREATE TABLE IF NOT EXISTS demo_fixture(version INTEGER PRIMARY KEY)')
    if c.execute('SELECT 1 FROM demo_fixture').fetchone():return
    c.execute('INSERT INTO demo_fixture VALUES(1)')
    start=t-3*86400
    for who,name in [('demo-owner','Саша'),('demo-friend','Лена')]:
        c.execute('INSERT OR IGNORE INTO people(id,session_hash) VALUES(?,?)',(who,who))
        row=c.execute('SELECT goal,name FROM people WHERE id=?',(who,)).fetchone()
        if not row['goal']:core.operate(c,who,'profile',dict(name=name,goal='Регулярное движение',barrier='Мало времени',program='Своя программа'),start)
    for mode in ('circle','duel'):
        gid=core.operate(c,'demo-owner','create',dict(mode=mode,kind='move'),start)['game']
        token=c.execute('SELECT token FROM games WHERE id=?',(gid,)).fetchone()[0]
        core.operate(c,'demo-friend','join',dict(token=token,kind='walk'),start+1)
    for days in (3,2,1):
        for who,kind in [('demo-owner','move'),('demo-friend','walk')]:
            core.operate(c,who,'done',dict(kind=kind,minutes=20,task=kind,visibility='circle'),t-days*86400+10)
    core.operate(c,'demo-friend','done',dict(kind='move',minutes=15,task='move',visibility='circle'),t-2)

