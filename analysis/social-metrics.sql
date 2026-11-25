-- Срез на :as_of. Гостевой D7 = реальное действие в седьмые сутки от входа [7,8).
WITH cohort AS (SELECT * FROM people WHERE joined_at<=:as_of)
SELECT channel, guest, COUNT(*) entrants,
 SUM(EXISTS(SELECT 1 FROM activity a WHERE a.person=p.person AND a.kind IN ('action_completed','food_action_completed') AND a.at<=:as_of)) activated,
 SUM(datetime(joined_at,'+8 days')<=:as_of) mature_d7,
 SUM(datetime(joined_at,'+8 days')<=:as_of AND EXISTS(SELECT 1 FROM activity a WHERE a.person=p.person
 AND a.kind IN ('action_completed','food_action_completed') AND a.at>=datetime(p.joined_at,'+7 days')
 AND a.at<datetime(p.joined_at,'+8 days') AND a.at<=:as_of)) active_d7
FROM cohort p GROUP BY channel,guest ORDER BY channel,guest;
