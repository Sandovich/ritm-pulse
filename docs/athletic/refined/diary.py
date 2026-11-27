"""Owner-scoped training and food journals for the internal pilot."""
from datetime import date
from math import isfinite

SCHEMA = """
CREATE TABLE IF NOT EXISTS workouts(
 id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES people(id), title TEXT NOT NULL,
 started INTEGER NOT NULL, day TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', rest_until INTEGER NOT NULL DEFAULT 0);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_workout ON workouts(owner) WHERE status='active';
CREATE TABLE IF NOT EXISTS workout_sets(
 workout TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE, position INTEGER NOT NULL,
 exercise TEXT NOT NULL, kg REAL NOT NULL, reps INTEGER NOT NULL, PRIMARY KEY(workout,position));
CREATE TABLE IF NOT EXISTS workout_steps(
 workout TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE, idx INTEGER NOT NULL, title TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'next', PRIMARY KEY(workout,idx));
CREATE TABLE IF NOT EXISTS food_log(
 id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES people(id), day TEXT NOT NULL, title TEXT NOT NULL,
 grams REAL NOT NULL, kcal REAL NOT NULL, protein REAL NOT NULL, fat REAL NOT NULL, carbs REAL NOT NULL);
"""

def state(c, who):
    workouts = [dict(r) for r in c.execute("SELECT id,title,started,day,status,rest_until FROM workouts WHERE owner=? ORDER BY started DESC",(who,))]
    by_id = {w["id"]:w for w in workouts}
    for w in workouts:
        w["sets"] = []
        w["steps"] = []
    for r in c.execute("SELECT s.* FROM workout_steps s JOIN workouts w ON w.id=s.workout WHERE w.owner=? ORDER BY idx",(who,)):
        by_id[r["workout"]]["steps"].append(dict(r))
    for r in c.execute("SELECT s.* FROM workout_sets s JOIN workouts w ON w.id=s.workout WHERE w.owner=? ORDER BY position",(who,)):
        by_id[r["workout"]]["sets"].append(dict(r))
    food = [dict(r) for r in c.execute("SELECT id,day,title,grams,kcal,protein,fat,carbs FROM food_log WHERE owner=? ORDER BY day DESC,rowid DESC",(who,))]
    return dict(workouts=workouts, food_log=food)

def number(b,key,low,high):
    value=float(b[key] if key in b else -1)
    if not isfinite(value) or not low <= value <= high:
        raise ValueError("Проверь числовые значения.")
    return value

def title(b):
    text=b.get("title")
    if not isinstance(text,str) or not 1 <= len(text.strip()) <= 80:
        raise ValueError("Укажи название длиной до 80 символов.")
    return text.strip()

def record(c, who, verb, b, t, day, ident):
    uid=b.get("id","")
    if verb=="journal_start":
        active=c.execute("SELECT id FROM workouts WHERE owner=? AND status='active'",(who,)).fetchone()
        if not active:
            plan=b.get("steps",[])
            if not isinstance(plan,list) or len(plan)>40 or any(not isinstance(v,str) or not 1<=len(v.strip())<=80 for v in plan):
                raise ValueError("Проверь названия упражнений.")
            workout_id=ident()
            c.execute("INSERT INTO workouts(id,owner,title,started,day) VALUES(?,?,?,?,?)",(workout_id,who,title(b),int(t),str(day(t))))
            c.executemany("INSERT INTO workout_steps(workout,idx,title) VALUES(?,?,?)",[(workout_id,i,v.strip()) for i,v in enumerate(plan,1)])
    elif verb in ("journal_set","journal_end","journal_next"):
        w=c.execute("SELECT id FROM workouts WHERE owner=? AND id=? AND status='active'",(who,uid)).fetchone()
        if not w:
            raise ValueError("Занятие уже закрыто. Обнови дневник.")
        if verb=="journal_next":
            idx=b.get("idx")
            status=b.get("status")
            if status not in ("done","skipped") or not isinstance(idx,int):
                raise ValueError("Проверь выбранное упражнение.")
            changed=c.execute("UPDATE workout_steps SET status=? WHERE workout=? AND idx=? AND status='next' AND idx=(SELECT MIN(idx) FROM workout_steps WHERE workout=? AND status='next')",(status,uid,idx,uid))
            if not changed.rowcount:
                raise ValueError("Очередь упражнений изменилась. Обнови дневник.")
        elif verb=="journal_set":
            kg=number(b,"kg",0,1500)
            reps=number(b,"reps",1,10000)
            if not reps.is_integer():
                raise ValueError("Повторения должны быть целыми.")
            position=c.execute("SELECT count(*) FROM workout_sets WHERE workout=?",(uid,)).fetchone()[0]+1
            c.execute("INSERT INTO workout_sets VALUES(?,?,?,?,?)",(uid,position,title(b),kg,int(reps)))
            c.execute("UPDATE workouts SET rest_until=? WHERE id=?",(int(t)+int(number(b,"rest",0,3600)),uid))
        else:
            status=b.get("status")
            if status=="discard":
                c.execute("DELETE FROM workouts WHERE id=?",(uid,))
            elif status in ("complete","partial"):
                c.execute("UPDATE workouts SET status=?,rest_until=0 WHERE id=?",(status,uid))
            else:
                raise ValueError("Выбери способ завершения.")
    elif verb in ("journal_food","journal_delete"):
        if uid and not c.execute("SELECT 1 FROM food_log WHERE owner=? AND id=?",(who,uid)).fetchone():
            raise ValueError("Запись недоступна.")
        if verb=="journal_delete":
            c.execute("DELETE FROM food_log WHERE owner=? AND id=?",(who,uid))
        else:
            d=date.fromisoformat(b.get("day",""))
            if d>day(t):
                raise ValueError("Выбери дату фактического приёма пищи.")
            nutrients=[number(b,k,0,1000 if k=="kcal" else 100) for k in ("kcal","protein","fat","carbs")]
            values=(str(d),title(b),number(b,"grams",0.1,10000),*nutrients)
            if uid:
                c.execute("UPDATE food_log SET day=?,title=?,grams=?,kcal=?,protein=?,fat=?,carbs=? WHERE id=? AND owner=?",(*values,uid,who))
            else:
                c.execute("INSERT INTO food_log VALUES(?,?,?,?,?,?,?,?,?)",(ident(),who,*values))
    else:
        raise ValueError("Неизвестное действие дневника.")
    return {}
