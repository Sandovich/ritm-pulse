"""Локальная сверка теста. Оплаты принимает организатор отдельно, по коду заявки."""
import argparse
from contextlib import closing
from datetime import datetime,timezone
from decimal import Decimal
from pathlib import Path
import sqlite3

def record(c,ref,operation,kind,amount,when,partner):
    c.execute('BEGIN IMMEDIATE')
    try:
        booking=c.execute('SELECT price,at FROM bookings WHERE ref=?',(ref,)).fetchone()
        if not booking or when<booking[1]:raise ValueError('Проверьте заявку и время операции.')
        if not operation.strip() or len(operation)>120 or amount<=0:raise ValueError('Проверьте номер и сумму операции.')
        row=c.execute('SELECT ref,kind,kopeks,at,partner FROM receipts WHERE id=?',(operation,)).fetchone()
        signature=(ref,kind,amount,when,partner)
        if row:
            if tuple(row)!=signature:raise ValueError('Этот ID относится к другой операции.')
            c.commit();return
        paid=c.execute("SELECT kopeks,at,partner FROM receipts WHERE ref=? AND kind='paid'",(ref,)).fetchone()
        if kind=='paid':
            if paid or amount!=booking[0]*100:raise ValueError('Ожидается одна полная оплата по цене заявки.')
        elif kind=='refund':
            refunded=c.execute("SELECT COALESCE(SUM(kopeks),0) FROM receipts WHERE ref=? AND kind='refund'",(ref,)).fetchone()[0]
            if not paid or when<paid[1] or refunded+amount>paid[0] or partner!=paid[2]:raise ValueError('Проверьте сумму, исходную оплату и атрибуцию возврата.')
        else:raise ValueError('Неизвестный тип операции.')
        c.execute('INSERT INTO receipts VALUES(?,?,?,?,?,?)',(operation,ref,kind,amount,when,partner))
        c.commit()
    except Exception:
        c.rollback();raise
def ts(s):
    dt=datetime.fromisoformat(s.replace('Z','+00:00'))
    if not dt.tzinfo:raise ValueError('Укажите часовой пояс, например +03:00.')
    return dt.timestamp()
def report(c,cut):
    for arm in ('benefit','pulse'):
        vals=c.execute("""SELECT COUNT(DISTINCT CASE WHEN e.step='intro' THEN e.person END),
        COUNT(DISTINCT CASE WHEN e.step='start' AND EXISTS(SELECT 1 FROM exposures i WHERE i.person=v.person AND i.step='intro' AND i.at<=e.at) THEN e.person END)
        FROM visitors v JOIN exposures e USING(person) WHERE v.arm=? AND e.at<=?""",(arm,cut)).fetchone()
        print('Обещание',arm,'увидели / нажали CTA',*vals)
    viewers=c.execute("SELECT count(*) FROM exposures WHERE step='offers' AND at<=?",(cut,)).fetchone()[0]
    for k in ('FOOD','RESET','DUO'):
        rows=c.execute("""SELECT b.seats,MAX(CASE WHEN r.kind='paid' THEN 1 ELSE 0 END), COALESCE(SUM(CASE WHEN r.kind='paid' THEN r.kopeks ELSE -r.kopeks END),0),
        MAX(CASE WHEN r.kind='paid' AND r.partner='artem' THEN 1 ELSE 0 END) FROM bookings b LEFT JOIN receipts r ON b.ref=r.ref AND r.at<=?
        WHERE b.sku=? AND b.at<=? GROUP BY b.ref""",(cut,k,cut)).fetchall()
        print(k,'показы витрины / заявки / оплаты / заказы с остатком / мест в этих заказах / получено после возвратов ₽ / из них атрибутировано Артёму ₽',
          viewers,len(rows),sum(x[1] for x in rows),sum(x[2]>0 for x in rows),sum(x[0] for x in rows if x[2]>0),
          sum(x[2] for x in rows)/100,sum(x[2] for x in rows if x[3])/100)
if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('db',type=Path);sub=parser.add_subparsers(dest='cmd',required=True)
    r=sub.add_parser('report');r.add_argument('--as-of')
    a=sub.add_parser('record');a.add_argument('ref');a.add_argument('operation');a.add_argument('kind',choices=['paid','refund']);a.add_argument('rub',type=Decimal);a.add_argument('time');a.add_argument('--partner',choices=['artem','direct'],default='direct')
    v=parser.parse_args()
    if not v.db.is_file():parser.error('Укажите существующую базу пилота.')
    with closing(sqlite3.connect(v.db)) as c:
        if v.cmd=='report':report(c,ts(v.as_of) if v.as_of else datetime.now(timezone.utc).timestamp())
        else:
            coins=v.rub*100
            if coins!=coins.to_integral_value():parser.error('Допустимы рубли и копейки.')
            record(c,v.ref,v.operation,v.kind,int(coins),ts(v.time),v.partner)
            print('Операция учтена.')

