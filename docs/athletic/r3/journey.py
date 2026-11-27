"""Private preferences, progress and social history for the mobile interface."""
import json
SCHEMA="""
CREATE TABLE IF NOT EXISTS solo_enrolments(
  person TEXT NOT NULL REFERENCES people, plan TEXT NOT NULL, started REAL NOT NULL,
  selected INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(person,plan));
CREATE TABLE IF NOT EXISTS solo_days(
  person TEXT NOT NULL, plan TEXT NOT NULL, day TEXT NOT NULL, action TEXT NOT NULL REFERENCES actions,
  PRIMARY KEY(person,plan,day), FOREIGN KEY(person,plan) REFERENCES solo_enrolments(person,plan));
CREATE UNIQUE INDEX IF NOT EXISTS one_current_solo ON solo_enrolments(person) WHERE selected=1;
CREATE TABLE IF NOT EXISTS mobile_prefs(person TEXT PRIMARY KEY REFERENCES people, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS cheers(circle TEXT REFERENCES games,action TEXT REFERENCES actions,person TEXT REFERENCES people,at REAL NOT NULL,PRIMARY KEY(circle,action,person));
CREATE TABLE IF NOT EXISTS training_notes(action TEXT PRIMARY KEY REFERENCES actions,workout TEXT NOT NULL,sets INTEGER NOT NULL,reps INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS expert_interest(person TEXT REFERENCES people,role TEXT NOT NULL,kind TEXT NOT NULL,at REAL NOT NULL,PRIMARY KEY(person,role,kind));
"""
EXTRA_FOOD=('Яйцо на тосте с зеленью','Овсянка с яблоком','Зелёный боул с авокадо','Боул с нутом и рисом','Паста с зеленью','Салат с фасолью и томатами')
def solo_state(c, person):
    entries=c.execute("""SELECT s.plan,s.selected,COUNT(d.day) AS days FROM solo_enrolments s
        LEFT JOIN solo_days d ON s.person=d.person AND s.plan=d.plan
        WHERE s.person=? GROUP BY s.plan,s.selected""",(person,))
    return {r['plan']:dict(selected=bool(r['selected']),days=min(3,r['days'])) for r in entries}

def mark_solo(c,person,kind,task,training,day,action):
    if kind=='food' and task in EXTRA_FOOD: plan='kitchen'
    elif kind=='walk': plan='walk'
    elif kind=='move' and training: plan=training['workout']
    else: return
    c.execute("""INSERT OR IGNORE INTO solo_days(person,plan,day,action)
        SELECT person,plan,?,? FROM solo_enrolments WHERE person=? AND plan=? AND selected=1""",
        (day,action,person,plan))

def extra(c,p,t):
    s=c.execute('SELECT data FROM mobile_prefs WHERE person=?',(p,)).fetchone()
    stats=[dict(r) for r in c.execute('SELECT a.id,a.day,a.kind,a.minutes,a.at,a.label,a.variant,n.workout,n.sets,n.reps,NOT EXISTS(SELECT 1 FROM hidden_actions h WHERE h.action=a.id) AS shared FROM actions a LEFT JOIN training_notes n ON n.action=a.id WHERE a.person=? AND a.at>=? ORDER BY a.at DESC',(p,t-56*86400))]
    feed=[dict(r) for r in c.execute("""SELECT g.id AS circle,a.id AS action,a.person,p.name,a.kind,a.at,
        (SELECT count(*) FROM cheers h WHERE h.circle=g.id AND h.action=a.id) cheers,
        EXISTS(SELECT 1 FROM cheers h WHERE h.circle=g.id AND h.action=a.id AND h.person=?) cheered,
        EXISTS(SELECT 1 FROM replies r JOIN actions src ON src.id=r.source_action WHERE r.game=g.id AND r.reply_action=a.id AND src.person=?) to_me
        FROM members viewer JOIN games g ON viewer.game=g.id AND g.mode='circle'
        JOIN members m ON m.game=g.id JOIN actions a ON a.person=m.person AND a.at>=MAX(m.joined,viewer.joined)
        JOIN people p ON p.id=a.person WHERE viewer.person=? AND a.at>=? AND NOT EXISTS (SELECT 1 FROM hidden_actions h WHERE h.action=a.id)
        ORDER BY a.at DESC LIMIT 60""",(p,p,p,t-28*86400))]
    leads=[r[0]+':'+r[1] for r in c.execute('SELECT role,kind FROM expert_interest WHERE person=?',(p,))]
    return dict(solo=solo_state(c,p),dna=json.loads(s[0]) if s else {},history=stats,feed=feed,interest=leads)
def operate(c,p,v,b,t):
    if v=='solo-select':
        plan=b.get('plan')
        if plan not in ('walk','kitchen','studio','strength'):
            raise ValueError('Выбери программу из каталога.')
        c.execute('UPDATE solo_enrolments SET selected=0 WHERE person=? AND selected=1',(p,))
        c.execute('''INSERT INTO solo_enrolments(person,plan,started) VALUES(?,?,?)
                     ON CONFLICT(person,plan) DO UPDATE SET selected=1''',(p,plan,t))
    elif v=='dna':
        d=b.get('data')
        if not isinstance(d,dict) or len(d)>18 or any(not isinstance(k,str) or not isinstance(x,str) or len(k)>32 or len(x)>180 for k,x in d.items()):raise ValueError('Проверьте ответы анкеты.')
        c.execute('INSERT INTO mobile_prefs VALUES(?,?) ON CONFLICT(person) DO UPDATE SET data=excluded.data',(p,json.dumps(d,ensure_ascii=False)))
    elif v=='cheer':
        g=b.get('circle');a=b.get('action')
        eligible=c.execute("""SELECT 1 FROM games g JOIN members v ON v.game=g.id JOIN members m ON m.game=g.id
        JOIN actions a ON a.person=m.person AND a.at>=MAX(m.joined,v.joined) WHERE g.id=? AND g.mode='circle' AND v.person=? AND a.id=? AND a.person<>? AND NOT EXISTS(SELECT 1 FROM hidden_actions h WHERE h.action=a.id)""",(g,p,a,p)).fetchone()
        if not eligible:raise ValueError('Действие недоступно.')
        if b.get('on') is True:c.execute('INSERT OR IGNORE INTO cheers VALUES(?,?,?,?)',(g,a,p,t))
        else:c.execute('DELETE FROM cheers WHERE circle=? AND action=? AND person=?',(g,a,p))
    elif v=='interest':
        role=b.get('role');kind=b.get('kind')
        expert_offer=role in ('train','food','ai') and kind in ('consult','program','event','plus')
        if not expert_offer and (role,kind) not in (('platform','plus'),('platform','plus990')):
            raise ValueError('Предложение недоступно.')
        c.execute('INSERT OR IGNORE INTO expert_interest VALUES(?,?,?,?)',(p,role,kind,t))
    return {}

