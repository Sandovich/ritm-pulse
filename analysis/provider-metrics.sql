-- Реализованную стоимость высвобожденного часа подтвердить оплаченной заменой либо сокращением затрат.
SELECT cluster_id,role,SUM(minutes) AS minutes,
 ROUND(SUM(1.0*minutes*rate_per_hour_kopeks/60)/100,2) AS labor_rub
FROM staff_work WHERE day<=date(:as_of) GROUP BY cluster_id,role;

