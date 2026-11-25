"""python analysis/import-social.py web/pilot-local.sqlite analysis/field.sqlite
Добавляет серверные события в локальную базу аналитики. Сессии и ссылки не копируются.
"""
import argparse,sqlite3
from pathlib import Path
from datetime import datetime,timezone
def stamp(t):return datetime.fromtimestamp(t,timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
def sync(source,target):
    if not Path(source).is_file() or Path(source).resolve()==Path(target).resolve():raise ValueError('Укажите разные пути и существующую базу сервера')
    with sqlite3.connect(Path(source).resolve().as_uri()+'?mode=ro',uri=True) as src,sqlite3.connect(target) as dst:
        src.execute('BEGIN');dst.execute('PRAGMA foreign_keys=ON')
        if not dst.execute("SELECT 1 FROM sqlite_master WHERE name='people'").fetchone():dst.executescript(Path(__file__).with_name('pilot-schema.sql').read_text('utf-8-sig'))
        for pid,first in src.execute("SELECT person,MIN(at) FROM events WHERE kind='visitor_created' GROUP BY person"):
            view=src.execute("SELECT min(at) FROM events WHERE person=? AND kind='invite_viewed'",(pid,)).fetchone()[0]
            # Аналитическая атрибуция гостевого входа: переход по приглашению в первые 60 секунд.
            guest=int(view is not None and first<=view<=first+60)
            dst.execute('INSERT INTO people VALUES(?,?,?,?) ON CONFLICT(person) DO UPDATE SET channel=excluded.channel,guest=excluded.guest',(pid,stamp(first),'invite' if guest else 'direct_unknown',guest))
        for gid,mode,host,t in src.execute('SELECT id,mode,host,created FROM games'):
            dst.execute('INSERT OR IGNORE INTO groups_pulse VALUES(?,?,?,?)',(gid,mode,host,stamp(t)))
        for gid,pid,t in src.execute('SELECT game,person,joined FROM members'):
            dst.execute('INSERT OR IGNORE INTO social_members VALUES(?,?,?)',(gid,pid,stamp(t)))
        for eid,pid,gid,kind,t,minutes in src.execute('SELECT id,person,game,kind,at,minutes FROM events'):
            dst.execute('INSERT OR IGNORE INTO activity VALUES(?,?,?,?,?,?)',(f'web:{pid}:{eid}',pid,gid,kind,stamp(t),minutes))
if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('server_db');ap.add_argument('analytics_db');a=ap.parse_args();sync(a.server_db,a.analytics_db)
