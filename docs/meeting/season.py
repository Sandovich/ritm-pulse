"""Personal plans, commercial experiment and outcome journal for the pilot."""
import hashlib
import itertools
import os
from urllib.parse import urlsplit
import json
import secrets
from datetime import datetime, timedelta, timezone

OFFERS = {
    'FOOD': ('Питание на 28 дней', 2490, 1),
    'RESET': ('28 дней изменений', 3490, 1),
    'DUO': ('Сезон для двоих', 5490, 2),
}
FIELDS = {
    'focus': ['Регулярность тренировок', 'Стать сильнее', 'Питание в будни', 'Больше движения'],
    'days': [2, 3, 4, 5, 6, 7],
    'duration': [5, 10, 15, 20, 30, 60],
    'place': ['Дома', 'В зале', 'На улице'],
    'food_for': ['Для себя', 'Для двоих', 'Для семьи'],
    'cooking': ['15 минут', '30 минут', 'Готовить впрок'],
    'adaptation': ['Подойдёт привычная нагрузка','Сначала согласовать с тренером'],
    'equipment': ['Без оборудования', 'Есть инвентарь', 'Есть свой план тренера'],
    'budget': ['Важна доступная цена', 'Важнее сэкономить время'],
}
METRICS = {
    'Регулярность тренировок': ('Дней с тренировкой за последние 7 дней', 7),
    'Стать сильнее': ('Повторений в одном выбранном упражнении при одинаковой нагрузке', 300),
    'Питание в будни': ('Будних дней с запланированной едой за последние 5 будней', 5),
    'Больше движения': ('Дней с прогулкой за последние 7 дней', 7),
}
SCHEMA = """
CREATE TABLE IF NOT EXISTS seasons(person TEXT PRIMARY KEY REFERENCES people, started REAL NOT NULL, plan TEXT NOT NULL, baseline INTEGER, goal_value INTEGER, comparison TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS checkins(person TEXT REFERENCES seasons, week INTEGER CHECK(week BETWEEN 1 AND 4), at REAL NOT NULL, ease INTEGER CHECK(ease BETWEEN 1 AND 5), actual INTEGER, PRIMARY KEY(person,week));
CREATE TABLE IF NOT EXISTS visitors(person TEXT PRIMARY KEY REFERENCES people, arm TEXT NOT NULL, ordering TEXT NOT NULL, channel TEXT NOT NULL, at REAL NOT NULL);
CREATE TABLE IF NOT EXISTS exposures(person TEXT REFERENCES visitors, step TEXT NOT NULL, at REAL NOT NULL, PRIMARY KEY(person,step));
CREATE TABLE IF NOT EXISTS bookings(ref TEXT PRIMARY KEY,person TEXT NOT NULL UNIQUE REFERENCES visitors,sku TEXT NOT NULL,price INTEGER NOT NULL, seats INTEGER NOT NULL,at REAL NOT NULL);
CREATE TABLE IF NOT EXISTS receipts(id TEXT PRIMARY KEY,ref TEXT NOT NULL REFERENCES bookings,kind TEXT NOT NULL CHECK(kind IN ('paid','refund')),kopeks INTEGER NOT NULL CHECK(kopeks>0),at REAL NOT NULL,partner TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS hidden_actions(action TEXT PRIMARY KEY REFERENCES actions);
CREATE TABLE IF NOT EXISTS recovery(person TEXT PRIMARY KEY REFERENCES people,digest TEXT NOT NULL UNIQUE);
"""
def check(ok,msg):
    if not ok: raise ValueError(msg)
def state(c,p,t):
    row=c.execute('SELECT * FROM seasons WHERE person=?',(p,)).fetchone()
    v=c.execute('SELECT arm,ordering,channel FROM visitors WHERE person=?',(p,)).fetchone()
    b=c.execute('SELECT ref,sku,price,seats FROM bookings WHERE person=?',(p,)).fetchone()
    result={'allocation':dict(v) if v else None,'booking':dict(b) if b else None,'season':None}
    if b:
        paid, refunded = c.execute("""SELECT COALESCE(SUM(CASE WHEN kind='paid' THEN kopeks END),0),
            COALESCE(SUM(CASE WHEN kind='refund' THEN kopeks END),0) FROM receipts WHERE ref=? AND at<=?""",(b['ref'],t)).fetchone()
        result['booking'].update(paid_kopeks=paid, refunded_kopeks=refunded)
        url=os.getenv('RITM_'+b['sku']+'_CHECKOUT','').strip()
        link=urlsplit(url)
        if not paid and b['price']==OFFERS[b['sku']][1] and link.scheme=='https' and link.hostname and not link.username and not link.password:
            result['booking']['checkout']=url
    if not row:return result
    plan=json.loads(row['plan']);focus=plan['focus']; start=row['started']
    d=min(28,int((t-start)//86400)+1)
    checks=[dict(r) for r in c.execute('SELECT week,at,ease,actual FROM checkins WHERE person=? ORDER BY week',(p,))]
    days=c.execute('SELECT COUNT(DISTINCT day) FROM actions WHERE person=? AND at BETWEEN ? AND ?',(p,start,min(t,start+28*86400-0.001))).fetchone()[0]
    result['season']={'plan':plan,'day':d,'elapsed':max(0,int((t-start)//86400)), 'metric':METRICS[focus][0],'max':METRICS[focus][1],
        'baseline':row['baseline'],'target':row['goal_value'],'comparison':row['comparison'],'checkins':checks,'active_days':days}
    return result

def operate(c,p,verb,data,t):
    if verb in ('exposure','allocate'):
        step=data.get('step');check(verb=='allocate' or step in ('intro','offers','start'),'Неизвестный экран.')
        if not c.execute('SELECT 1 FROM visitors WHERE person=?',(p,)).fetchone():
            channel=data.get('channel','direct')
            if channel not in ('direct','coach','artem','friend'):channel='direct'
            c.execute('INSERT INTO visitors VALUES(?,?,?,?,?)',(p,secrets.choice(('benefit','pulse')),','.join(secrets.choice(list(itertools.permutations(OFFERS)))),channel,t))
        if verb=='allocate':return {}
        c.execute('INSERT OR IGNORE INTO exposures VALUES(?,?,?)',(p,step,t));return {}
    if verb=='book':
        sku=data.get('sku');check(sku in OFFERS,'Выберите сезон.')
        check(c.execute("SELECT 1 FROM exposures WHERE person=? AND step='offers'",(p,)).fetchone(),'Сначала откройте предложения.')
        old=c.execute('SELECT sku,ref FROM bookings WHERE person=?',(p,)).fetchone()
        if old:
            check(old['sku']==sku,'Вы уже оставили заявку на этот тест.');return {'ref':old['ref']}
        _,price,seats=OFFERS[sku]
        ref=secrets.token_hex(7).upper()
        c.execute('INSERT INTO bookings VALUES(?,?,?,?,?,?)',(ref,p,sku,price,seats,t));return {'ref':ref}
    if verb=='season':
        plan=data.get('plan');check(isinstance(plan,dict) and all(plan.get(k) in values for k,values in FIELDS.items()),'Проверьте ответы анкеты.')
        plan={k:plan[k] for k in FIELDS}
        comp=data.get('comparison','');check(isinstance(comp,str) and len(comp)<=100,'До 100 знаков для условий замера.')
        if plan['focus']=='Стать сильнее':check(comp.strip(),'Запишите упражнение и постоянную нагрузку.')
        lo,hi=data.get('baseline'),data.get('target');maxval=METRICS[plan['focus']][1]
        check(all(v is None or type(v) is int and 0<=v<=maxval for v in (lo,hi)),'Показатель вне диапазона.')
        row=c.execute('SELECT * FROM seasons WHERE person=?',(p,)).fetchone()
        if row:
            check(json.loads(row['plan'])['focus']==plan['focus'] and row['baseline']==lo and row['comparison']==comp,'Исходная точка и способ замера закреплены за сезоном.')
            c.execute('UPDATE seasons SET plan=?,goal_value=? WHERE person=?',(json.dumps(plan,ensure_ascii=False),hi,p))
        else:c.execute('INSERT INTO seasons VALUES(?,?,?,?,?,?)',(p,t,json.dumps(plan,ensure_ascii=False),lo,hi,comp))
        category={'Питание в будни':'Питание','Регулярность тренировок':'Регулярное движение','Стать сильнее':'Физическая форма','Больше движения':'Прогулки'}[plan['focus']]
        c.execute("UPDATE people SET goal=?,name=CASE WHEN name='' THEN 'Участник' ELSE name END,barrier='Мало времени',program='Своя программа' WHERE id=? AND goal=''",(category,p))
        return {}
    if verb=='checkin':
        row=c.execute('SELECT started,plan FROM seasons WHERE person=?',(p,)).fetchone()
        check(row,'Сначала начните личный сезон.')
        week=data.get('week');ease=data.get('ease');actual=data.get('actual')
        check(type(week) is int and 1<=week<=4 and t>=row['started']+(7*week-1)*86400,'Сверка откроется в конце этой недели.')
        high=METRICS[json.loads(row['plan'])['focus']][1]
        check(type(ease) is int and 1<=ease<=5 and (actual is None or type(actual) is int and 0<=actual<=high),'Проверьте значения сверки.')
        c.execute('INSERT INTO checkins VALUES(?,?,?,?,?) ON CONFLICT(person,week) DO UPDATE SET at=excluded.at,ease=excluded.ease,actual=excluded.actual',(p,week,t,ease,actual));return {}
    raise ValueError('Неизвестная операция.')

