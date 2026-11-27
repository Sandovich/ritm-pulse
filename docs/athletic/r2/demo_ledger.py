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
