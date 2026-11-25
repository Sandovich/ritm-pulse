-- Полевой импорт перечня включённых людей в TEMP study_cohort(person,started): Unix UTC.
-- :as_of — Unix UTC. День старта считается первым днём; неделя 5 = дни 29–35.
-- Все включённые с полным окном в знаменателе, в том числе ни разу не открывшие круг.
WITH weeks(w) AS (VALUES(1),(2),(3),(4),(5),(6),(7),(8)),
eligible AS (
 SELECT p.person,w,started+(w-1)*604800 lo,started+w*604800 hi FROM study_cohort p
 CROSS JOIN weeks WHERE started+w*604800<=:as_of
), edges AS (
 SELECT e.person actor,a.person peer,e.at FROM events e JOIN actions a ON a.id=e.nonce WHERE e.kind='pulse_answered'
), flags AS (
 SELECT c.*,
 EXISTS(SELECT 1 FROM edges x WHERE x.actor=c.person AND x.at>=c.lo AND x.at<c.hi) outgoing,
 EXISTS(SELECT 1 FROM edges x JOIN edges y ON y.actor=x.peer AND y.peer=x.actor
 WHERE x.actor=c.person AND x.at>=c.lo AND x.at<c.hi AND y.at>=c.lo AND y.at<c.hi) reciprocal
 FROM eligible c)
SELECT w,COUNT(*) eligible,SUM(outgoing) answered,SUM(reciprocal) two_way,
 ROUND(AVG(outgoing),3) answer_rate,ROUND(AVG(reciprocal),3) two_way_rate
FROM flags GROUP BY w ORDER BY w;
