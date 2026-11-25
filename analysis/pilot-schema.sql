-- Журнал пилота и коммерческого учёта. Время UTC, YYYY-MM-DD HH:MM:SS. Суммы в копейках.
PRAGMA foreign_keys=ON;
CREATE TABLE people(person TEXT PRIMARY KEY, joined_at TEXT NOT NULL, channel TEXT NOT NULL,
 guest INTEGER NOT NULL CHECK(guest IN (0,1)));
CREATE TABLE clusters(cluster_id TEXT PRIMARY KEY, cohort TEXT NOT NULL, arm TEXT NOT NULL CHECK(arm IN ('usual','ritm')));
CREATE TABLE assignments(person TEXT PRIMARY KEY REFERENCES people, cluster_id TEXT NOT NULL REFERENCES clusters,
 assigned_at TEXT NOT NULL, missed_task TEXT NOT NULL);
CREATE TABLE alternatives(person TEXT NOT NULL REFERENCES assignments, original_task TEXT NOT NULL, alternative_task TEXT NOT NULL,
 PRIMARY KEY(person,original_task,alternative_task));
CREATE TABLE completions(event_id TEXT PRIMARY KEY,person TEXT NOT NULL REFERENCES assignments,
 completed_at TEXT NOT NULL, original_task TEXT NOT NULL, performed_task TEXT NOT NULL);
-- Один заранее определённый продукт продления и первое предложение на участника.
CREATE TABLE offers(offer_id TEXT PRIMARY KEY,person TEXT NOT NULL UNIQUE REFERENCES assignments,
 offered_at TEXT NOT NULL,product TEXT NOT NULL);
CREATE TABLE orders(order_id TEXT PRIMARY KEY, offer_id TEXT NOT NULL REFERENCES offers,paid_at TEXT NOT NULL,
 amount INTEGER NOT NULL CHECK(amount>0));
CREATE TABLE refunds(refund_id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES orders,
 refunded_at TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount>0));
CREATE TRIGGER valid_refund BEFORE INSERT ON refunds WHEN NEW.refunded_at<(SELECT paid_at FROM orders WHERE order_id=NEW.order_id)
 OR NEW.amount+COALESCE((SELECT SUM(amount) FROM refunds WHERE order_id=NEW.order_id),0)>(SELECT amount FROM orders WHERE order_id=NEW.order_id)
 BEGIN SELECT RAISE(ABORT,'refund outside ledger'); END;
CREATE TABLE groups_pulse(game_id TEXT PRIMARY KEY, mode TEXT NOT NULL CHECK(mode IN ('circle','duel','relay')),host TEXT NOT NULL REFERENCES people, offered_at TEXT NOT NULL);
CREATE TABLE social_members(game_id TEXT REFERENCES groups_pulse,person TEXT REFERENCES people,
 joined_at TEXT NOT NULL, PRIMARY KEY(game_id,person));
CREATE TABLE activity(event_id TEXT PRIMARY KEY, person TEXT NOT NULL REFERENCES people, game_id TEXT REFERENCES groups_pulse,
 kind TEXT NOT NULL, at TEXT NOT NULL,minutes INTEGER);
CREATE TABLE staff_work(entry_id TEXT PRIMARY KEY,cluster_id TEXT NOT NULL REFERENCES clusters,role TEXT NOT NULL,
 day TEXT NOT NULL,minutes INTEGER NOT NULL CHECK(minutes>0),rate_per_hour_kopeks INTEGER NOT NULL CHECK(rate_per_hour_kopeks>=0));
CREATE INDEX completion_window ON completions(person,completed_at);
CREATE INDEX refunds_cutoff ON refunds(order_id,refunded_at);
CREATE INDEX activity_window ON activity(person,at);
CREATE TABLE season_end(person TEXT PRIMARY KEY REFERENCES people,ends_at TEXT NOT NULL);
CREATE TABLE curator_contacts(contact_id TEXT PRIMARY KEY,person TEXT NOT NULL REFERENCES people,at TEXT NOT NULL);
