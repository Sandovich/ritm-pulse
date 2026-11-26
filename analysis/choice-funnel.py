"""Read-only CHOICE pilot funnel. --start inclusive and --end exclusive, Moscow time."""
import argparse
from contextlib import closing
from datetime import date, datetime, time, timedelta, timezone
import json
from pathlib import Path
import sqlite3

MSK = timezone(timedelta(hours=3))
DAY = 86400
LABELS = {
    'first':'Первый самостоятельный выбор инициатора',
    'later':'Повторный самостоятельный выбор инициатора',
    'swap':'Обратный выбор после смены ролей',
}
FUNNEL = """
WITH invites AS (
 SELECT c.*, CASE WHEN c.parent IS NOT NULL THEN 'swap'
     WHEN EXISTS(SELECT 1 FROM choices p WHERE p.owner=c.owner AND p.parent IS NULL
         AND (p.created<c.created OR (p.created=c.created AND p.rowid<c.rowid))) THEN 'later'
     ELSE 'first' END AS source
 FROM choices c WHERE c.created>=:start AND c.created<:end
), engagement AS (
 SELECT i.id,
     MAX(e.kind='choice_copied') AS copied,
     MAX(e.kind='choice_shared') AS shared,
     MAX(e.kind='choice_opened' AND e.person<>i.owner AND e.at<=COALESCE(i.voted,:end)) AS opened
 FROM invites i JOIN events e ON e.nonce=i.id AND e.at>=i.created AND e.at<:end
 WHERE e.kind IN ('choice_shared','choice_copied','choice_opened') GROUP BY i.id
)
SELECT i.source, COUNT(*) AS created,
       COUNT(CASE WHEN e.copied THEN 1 END) AS copied, COUNT(CASE WHEN e.shared THEN 1 END) AS shared,
       COUNT(CASE WHEN e.opened THEN 1 END) AS opened, COUNT(CASE WHEN i.voted<:end THEN 1 END) AS voted,
       COUNT(CASE WHEN i.completed<:end THEN 1 END) AS completed,
       COUNT(CASE WHEN i.created<=:end-:day THEN 1 END) AS mature_votes,
       COUNT(CASE WHEN i.created<=:end-:day AND i.voted<:end THEN 1 END) AS mature_voted,
       COUNT(CASE WHEN i.created<=:end-2*:day THEN 1 END) AS mature_completions,
       COUNT(CASE WHEN i.created<=:end-2*:day AND i.completed<:end THEN 1 END) AS mature_completed
FROM invites i LEFT JOIN engagement e ON e.id=i.id GROUP BY i.source
"""
PAIRS = """
WITH completed AS (
 SELECT MIN(owner,voter) AS left_id, MAX(owner,voter) AS right_id, completed AS ts
 FROM choices WHERE completed IS NOT NULL AND completed<:end
), cohorts AS (
 SELECT left_id,right_id,MIN(ts) AS first FROM completed GROUP BY left_id,right_id
 HAVING first>=:start
), returns AS (
 SELECT a.first, EXISTS(
     SELECT 1 FROM completed b WHERE a.left_id=b.left_id AND a.right_id=b.right_id
       AND b.ts>a.first AND b.ts<=a.first+7*:day
       AND date(b.ts,'unixepoch','+3 hours')>date(a.first,'unixepoch','+3 hours')
 ) AS returned FROM cohorts a
)
SELECT COUNT(*) AS first_completed_pairs,
       COUNT(CASE WHEN first<=:end-7*:day THEN 1 END) AS mature_pairs,
       COUNT(CASE WHEN first<=:end-7*:day AND returned THEN 1 END) AS returned_pairs
FROM returns
"""
FIELDS = ('created','copied','shared','opened','voted','completed','mature_votes','mature_voted',
          'mature_completions','mature_completed')

def compute(db_path, start, end):
    if start >= end:
        raise ValueError('Начало периода должно предшествовать концу.')
    path = Path(db_path).resolve()
    if not path.is_file():
        raise ValueError('Файл серверной базы не найден.')
    params = dict(start=start,end=end,day=DAY)
    with closing(sqlite3.connect(path.as_uri()+'?mode=ro', uri=True)) as db:
        db.row_factory = sqlite3.Row
        db.execute('PRAGMA query_only=ON')
        db.execute('BEGIN')
        if not db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='choices'").fetchone():
            raise ValueError('В этой базе ещё нет таблицы CHOICE.')
        funnel = {key:dict.fromkeys(FIELDS,0) for key in LABELS}
        for row in db.execute(FUNNEL,params):
            funnel[row['source']] = {k:row[k] for k in FIELDS}
        pairs = dict(db.execute(PAIRS,params).fetchone())
        return {'rounds':funnel,'pairs':pairs}

def midnight(raw):
    return datetime.combine(date.fromisoformat(raw),time(),MSK).timestamp()

def main():
    cli=argparse.ArgumentParser(description='Агрегаты CHOICE по серверной базе. Период и отсечение событий по Москве.')
    cli.add_argument('database')
    cli.add_argument('--start','--from',dest='start',metavar='ГГГГ-ММ-ДД',help='начало периода, включительно')
    cli.add_argument('--end','--to',dest='end',metavar='ГГГГ-ММ-ДД',help='конец периода, не включается. По умолчанию — сейчас')
    cli.add_argument('--json',action='store_true',help='агрегаты в машиночитаемой форме')
    args=cli.parse_args()
    now=datetime.now(MSK).timestamp()
    try:
        start=midnight(args.start) if args.start else 0
        end=min(midnight(args.end),now) if args.end else now
        result=compute(args.database,start,end)
    except (ValueError,sqlite3.Error) as error:
        cli.error(str(error))
    if args.json:
        print(json.dumps(result,ensure_ascii=False,indent=2))
        return
    print('Период (МСК):', datetime.fromtimestamp(start,MSK).isoformat(), '—', datetime.fromtimestamp(end,MSK).isoformat(),'исключительно')
    for key,label in LABELS.items():
        row=result['rounds'][key]
        print('\n'+label)
        print('Создано / скопировано / через «Поделиться» / открыто другом / выбран ход / завершено:',
              *(row[x] for x in FIELDS[:6]),sep='  ')
        print('Голос за 24 ч в зрелой когорте:',row['mature_voted'],'из',row['mature_votes'])
        print('Завершили за два окна по 24 ч в зрелой когорте:',row['mature_completed'],'из',row['mature_completions'])
    pairs=result['pairs']
    print('\nПар с первым завершённым ходом в периоде:',pairs['first_completed_pairs'])
    print('Пары, завершившие ещё один ход в другой день за следующие 7 суток:',
          pairs['returned_pairs'],'из',pairs['mature_pairs'],'пар с семью сутками наблюдения')
    print('Копирование и системная передача считаются по приглашениям. Получение ссылки устанавливается по открытию другом.')

if __name__=='__main__':
    main()
