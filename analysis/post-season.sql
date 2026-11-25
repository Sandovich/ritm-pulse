-- Конец сезона и персональные контакты вносятся по факту. Знаменатель — все активированные гости с созревшим окном.
WITH base AS (
 SELECT p.person,s.ends_at FROM people p JOIN season_end s USING(person)
 WHERE p.guest=1 AND datetime(s.ends_at,'+14 days')<=:as_of AND EXISTS(
 SELECT 1 FROM activity a WHERE a.person=p.person AND a.kind IN ('action_completed','food_action_completed') AND a.at<=s.ends_at)
),flag AS (
 SELECT b.*, EXISTS(SELECT 1 FROM activity a WHERE a.person=b.person AND a.kind IN ('action_completed','food_action_completed')
 AND a.at>=datetime(b.ends_at,'+7 days') AND a.at<datetime(b.ends_at,'+14 days')
 AND NOT EXISTS (SELECT 1 FROM curator_contacts c WHERE c.person=b.person AND c.at>b.ends_at AND c.at<=a.at)) AS independent
 FROM base b)
SELECT COUNT(*) AS eligible,COALESCE(SUM(independent),0) AS active_independent,ROUND(AVG(independent),4) AS rate FROM flag;
