-- :as_of UTC. Возврат за [назначение, +7 суток), продление за [предложение, +60 суток).
WITH observed AS (
 SELECT a.*,c.arm,c.cohort, o.offer_id,o.offered_at FROM assignments a JOIN clusters c USING(cluster_id)
 LEFT JOIN offers o ON o.person=a.person AND o.offered_at>=a.assigned_at AND o.offered_at<=:as_of
 WHERE a.assigned_at<=:as_of
), indicators AS (
 SELECT x.*,datetime(assigned_at,'+7 days')<=:as_of AS mature7,
 COALESCE(datetime(offered_at,'+60 days')<=:as_of,0) AS mature60,
 EXISTS(SELECT 1 FROM completions t WHERE t.person=x.person AND t.original_task=x.missed_task
 AND t.completed_at>=x.assigned_at AND t.completed_at<datetime(x.assigned_at,'+7 days') AND t.completed_at<=:as_of
 AND (t.performed_task=t.original_task OR EXISTS(SELECT 1 FROM alternatives v WHERE v.person=t.person
 AND v.original_task=t.original_task AND v.alternative_task=t.performed_task))) AS recovered,
 EXISTS(SELECT 1 FROM completions t WHERE t.person=x.person AND t.original_task=x.missed_task AND t.performed_task=t.original_task
 AND t.completed_at>=x.assigned_at AND t.completed_at<datetime(x.assigned_at,'+7 days') AND t.completed_at<=:as_of) AS original,
 EXISTS(SELECT 1 FROM orders b WHERE b.offer_id=x.offer_id AND b.paid_at>=x.offered_at AND b.paid_at<datetime(x.offered_at,'+60 days')
 AND b.paid_at<=:as_of AND b.amount>COALESCE((SELECT SUM(r.amount) FROM refunds r WHERE r.order_id=b.order_id AND r.refunded_at<=:as_of),0)) AS renewed
 FROM observed x)
SELECT cohort,arm,COUNT(*) assigned, COUNT(DISTINCT cluster_id) clusters,
 SUM(mature7) eligible7,SUM(mature7*recovered) returned7,SUM(mature7*original) original7,
 ROUND(1.0*SUM(mature7*recovered)/NULLIF(SUM(mature7),0),4) rate7,
 COUNT(offer_id) offered,SUM(mature60) eligible60,SUM(mature60*renewed) renewed60,
 ROUND(1.0*SUM(mature60*renewed)/NULLIF(SUM(mature60),0),4) rate60
FROM indicators GROUP BY cohort,arm ORDER BY cohort,arm;
