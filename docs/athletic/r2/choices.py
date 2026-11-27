"""Two-person, invitation-only CHOICE experiment. All writes share the action transaction."""
import json
import re
import secrets
import unicodedata

WINDOW = 86400
FOOD_TASK = 'Блюдо из моего плана'
SCHEMA = """
CREATE TABLE IF NOT EXISTS choices (
 id TEXT PRIMARY KEY, token TEXT NOT NULL UNIQUE, owner TEXT NOT NULL REFERENCES people,
 name TEXT NOT NULL, options TEXT NOT NULL, minutes INTEGER NOT NULL, created REAL NOT NULL,
 voter TEXT REFERENCES people, selected TEXT, voted REAL, completed REAL, action TEXT REFERENCES actions,
 parent TEXT UNIQUE REFERENCES choices, target TEXT REFERENCES people,
 CHECK(owner <> voter), CHECK(owner <> target)
);
CREATE UNIQUE INDEX IF NOT EXISTS choice_action ON choices(action) WHERE action IS NOT NULL;
CREATE INDEX IF NOT EXISTS choice_owner ON choices(owner,created);
CREATE INDEX IF NOT EXISTS choice_voter ON choices(voter,created);
CREATE INDEX IF NOT EXISTS choice_target ON choices(target,created);
CREATE TABLE IF NOT EXISTS duel_rewards(game TEXT PRIMARY KEY REFERENCES games, reward TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS choice_push_queue(
 choice TEXT REFERENCES choices, recipient TEXT REFERENCES people,
 endpoint TEXT REFERENCES push_subs ON DELETE CASCADE, attempts INTEGER NOT NULL DEFAULT 0,
 next_at REAL NOT NULL, PRIMARY KEY(choice,endpoint)
);
"""
def ensure(condition, message):
    if not condition:
        raise ValueError(message)

def reward(c, game):
    row = c.execute('SELECT reward FROM duel_rewards WHERE game=?', (game,)).fetchone()
    return row[0] if row else ''

def set_reward(c, game, mode, value):
    if value is None or value == '':
        return
    ensure(isinstance(value, str) and len(value) <= 80 and all(not unicodedata.category(x).startswith('C') for x in value), 'Введите награду длиной до 80 знаков.')
    value = value.strip()
    if not value:
        return
    ensure(mode == 'duel', 'Личная награда доступна в дуэли.')
    money = r'[₽$€£¥]|\b(?:руб(?:л\w*|\.)?|доллар\w*|евро|ден(?:ьг|еж)\w*|ставк\w*|наличны\w*|rur|rub|usd|eur|btc|usdt)\b|\d\s*(?:р\.?\b|тыс\b)'
    ensure(not re.search(money, value, re.I), 'Выберите совместное впечатление, например фильм или прогулку. Денежные ставки недоступны.')
    c.execute('INSERT INTO duel_rewards VALUES(?,?)', (game, value))

def plan(c, person):
    row = c.execute('SELECT p.goal,s.plan FROM people p LEFT JOIN seasons s ON s.person=p.id WHERE p.id=?', (person,)).fetchone()
    season = json.loads(row['plan']) if row['plan'] else {}
    options = [
        dict(id='walk', kind='walk', title='Прогуляться', description='Прогулка в своём темпе'),
        dict(id='move', kind='move', title='Размяться', description='Знакомая разминка по своему плану'),
        dict(id='food', kind='food', title='Собрать своё блюдо', description='Простой вариант питания из своего плана'),
    ]
    # The personalised plan can rule out an unsupervised exercise alternative.
    if season.get('adaptation') == 'Сначала согласовать с тренером':
        options = [x for x in options if x['kind'] != 'move']
    focus = {'Питание':'food', 'Регулярное движение':'move', 'Физическая форма':'move', 'Прогулки':'walk'}.get(row['goal'])
    return sorted(options, key=lambda x: x['kind'] != focus)

def expired(row, t):
    if row['completed'] is not None:
        return False
    start = row['voted'] if row['voted'] is not None else row['created']
    return t >= start + WINDOW

def item(row, person, t):
    owner = row['owner'] == person
    voter = row['voter'] == person
    target = row['target'] == person
    member = owner or voter or target
    value = {k:row[k] for k in ('id','name','minutes','created','voted','completed','selected')}
    value.update(options=json.loads(row['options']), role='owner' if owner else 'voter' if voter else 'guest',
                 expired=expired(row,t), owner=row['owner'] if member else None,
                 voter=row['voter'] if member else None, target=row['target'] if member else None,
                 parent=row['parent'] if member else None)
    if owner or (target and row['voted'] is None):
        value['token'] = row['token']
    return value

def state(c, person, t):
    rows = c.execute('SELECT * FROM choices WHERE owner=? OR voter=? OR target=? ORDER BY created DESC,rowid DESC', (person, person, person))
    return {'choice_plan':plan(c,person), 'choices':[item(row,person,t) for row in rows]}

def operate(c, person, verb, b, t, *, log, day, finish, minutes_allowed):
    def get(key, value):
        # The caller chooses the column from the two constants below.
        ensure(isinstance(value, str) and 0 < len(value) <= 64, 'Приглашение недоступно.')
        row = c.execute(f'SELECT * FROM choices WHERE {key}=?', (value,)).fetchone()
        ensure(row, 'Приглашение недоступно.')
        return row
    def answer(row):
        return {'choice':item(row,person,t)}
    def event(kind, cid, meaningful=False):
        if meaningful:
            previous = c.execute("""SELECT at FROM events WHERE person=? AND kind IN
                ('choice_created','choice_voted','choice_completed') ORDER BY at LIMIT 1""", (person,)).fetchone()
            if previous and day(previous[0]) < day(t):
                log(c,person,t,'choice_repeat_day',nonce=str(day(t)))
        log(c,person,t,kind,nonce=cid)
    if verb == 'choice_create':
        parent, target = b.get('parent'), None
        if parent is not None:
            prior = get('id',parent)
            ensure(prior['voter'] == person and prior['completed'] is not None, 'Роли можно поменять после выполнения выбранного дела.')
            child = c.execute('SELECT * FROM choices WHERE parent=?',(parent,)).fetchone()
            if child:
                return answer(child)
            target = prior['owner']
        available = {x['id']:x for x in plan(c,person)}
        ids = b.get('options')
        ensure(isinstance(ids,list) and len(ids)==2 and all(isinstance(i,str) and i in available for i in ids) and ids[0]!=ids[1], 'Выберите два разных дела из своего плана.')
        minutes = b.get('minutes')
        ensure(type(minutes) is int and minutes in minutes_allowed, 'Выберите доступное время.')
        cid, token = secrets.token_urlsafe(16), secrets.token_urlsafe(24)
        name = c.execute('SELECT name FROM people WHERE id=?',(person,)).fetchone()[0] or 'Друг'
        c.execute('INSERT INTO choices(id,token,owner,name,options,minutes,created,parent,target) VALUES(?,?,?,?,?,?,?,?,?)',
                  (cid,token,person,name,json.dumps([available[i] for i in ids],ensure_ascii=False),minutes,t,parent,target))
        event('choice_created',cid,True)
        if parent:
            event('choice_swapped',cid)
        return answer(get('id',cid))
    if verb in ('choice_open','choice_vote'):
        row = get('token',b.get('token'))
        owner, voter, target = row['owner'], row['voter'], row['target']
        ensure(person in (owner,voter) or (voter is None and (target is None or target==person)), 'Приглашение недоступно.')
        if verb == 'choice_open':
            ensure(person in (owner,voter,target) or not expired(row,t), 'Срок приглашения истёк.')
            if person!=owner and not expired(row,t):
                event('choice_opened',row['id'])
            return answer(row)
        ensure(person!=owner,'Передайте выбор другу.')
        option = b.get('option')
        ensure(isinstance(option,str) and any(x['id']==option for x in json.loads(row['options'])), 'Выберите одно из двух предложенных дел.')
        if voter == person:
            ensure(row['selected']==option, 'Вы уже выбрали ход.')
            return answer(row)
        ensure(not expired(row,t), 'Срок приглашения истёк.')
        c.execute('UPDATE choices SET voter=?,selected=?,voted=? WHERE id=? AND voter IS NULL',(person,option,t,row['id']))
        event('choice_voted',row['id'],True)
        return answer(get('id',row['id']))
    row = get('id',b.get('id'))
    ensure(row['owner']==person, 'Действие недоступно.')
    if verb == 'choice_share':
        method = b.get('method')
        ensure(method in ('share','copy'), 'Выберите способ передачи ссылки.')
        ensure(row['voter'] is None and not expired(row,t), 'Срок приглашения истёк или друг уже выбрал ход.')
        event('choice_shared' if method=='share' else 'choice_copied',row['id'])
        return answer(row)
    ensure(verb=='choice_complete', 'Неизвестная операция.')
    if row['completed'] is None:
        ensure(row['voter'] and not expired(row,t), 'Дождитесь выбора друга или создайте новый ход.')
        option = next(x for x in json.loads(row['options']) if x['id']==row['selected'])
        action = finish(option['kind'],row['minutes'])
        recorded_at = c.execute('SELECT at FROM actions WHERE id=?',(action,)).fetchone()[0]
        ensure(recorded_at >= row['voted'], 'Это дело уже было отмечено до выбора друга. Можно выполнить новый ход завтра, пока открыто приглашение.')
        ensure(not c.execute('SELECT 1 FROM choices WHERE action=?',(action,)).fetchone(),
               'Это дело уже зачтено в другом ходе сегодня. Вернитесь завтра, пока ход открыт.')
        c.execute('UPDATE choices SET completed=?,action=? WHERE id=?',(t,action,row['id']))
        c.execute("""INSERT OR IGNORE INTO choice_push_queue(choice,recipient,endpoint,next_at)
            SELECT ?,person,endpoint,? FROM push_subs WHERE person=?""",(row['id'],t,row['voter']))
        event('choice_completed',row['id'],True)
    return answer(get('id',row['id']))
