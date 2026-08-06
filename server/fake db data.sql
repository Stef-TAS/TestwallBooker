-- Seed data for local development
-- Database name matches the default MySQL connection in server/db.ts.
-- PLEASE DO NOT USE THIS FOR ACTUAL PROD!!!
USE testwallbooker;

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE command_history;
TRUNCATE TABLE logs;
TRUNCATE TABLE bookings;
TRUNCATE TABLE user_access_rights;
TRUNCATE TABLE testwalls;
TRUNCATE TABLE accounts;
TRUNCATE TABLE access_rights;
SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO access_rights (role_name, description)
VALUES
  ('admin', 'Administrator with full access'),
  ('user', 'Regular user with limited access'),
  ('operator', 'Can book and use testwalls');

INSERT INTO accounts (
  username,
  email,
  password_hash,
  first_name,
  last_name,
  location,
  timezone
)
VALUES
  ('admin', 'admin@testwall.local', '$2b$12$QS5UZ1R76KeR.7CoSDVeDOqm3Gha5LXXqaPxyBU/P62w3SceJ2Ebm', 'Avery', 'Stone', 'Stockholm, Sweden', 'Europe/Stockholm'),
  ('alice', 'alice@testwall.local', '$2b$12$ROkSIlNs77PlYJJ5JZ9JqeYyWHyiO6YY5O3zjrDeaRfJ03LFmXcBi', 'Alice', 'Nguyen', 'Berlin, Germany', 'Europe/Berlin'),
  ('bob', 'bob@testwall.local', '$2b$12$ROkSIlNs77PlYJJ5JZ9JqeYyWHyiO6YY5O3zjrDeaRfJ03LFmXcBi', 'Bob', 'Patel', 'London, UK', 'Europe/London'),
  ('charlie', 'charlie@testwall.local', '$2b$12$ROkSIlNs77PlYJJ5JZ9JqeYyWHyiO6YY5O3zjrDeaRfJ03LFmXcBi', 'Charlie', 'Johnson', 'New York, USA', 'America/New_York'),
  ('dana', 'dana@testwall.local', '$2b$12$ROkSIlNs77PlYJJ5JZ9JqeYyWHyiO6YY5O3zjrDeaRfJ03LFmXcBi', 'Dana', 'Lopez', 'Austin, USA', 'America/Chicago'),
  ('elena', 'elena@testwall.local', '$2b$12$ROkSIlNs77PlYJJ5JZ9JqeYyWHyiO6YY5O3zjrDeaRfJ03LFmXcBi', 'Elena', 'Petrov', 'Helsinki, Finland', 'Europe/Helsinki'),
  ('farid', 'farid@testwall.local', '$2b$12$ROkSIlNs77PlYJJ5JZ9JqeYyWHyiO6YY5O3zjrDeaRfJ03LFmXcBi', 'Farid', 'Khan', 'Dubai, UAE', 'Asia/Dubai'),
  ('grace', 'grace@testwall.local', '$2b$12$ROkSIlNs77PlYJJ5JZ9JqeYyWHyiO6YY5O3zjrDeaRfJ03LFmXcBi', 'Grace', 'Miller', 'Toronto, Canada', 'America/Toronto');

SELECT id INTO @admin_user_id FROM accounts WHERE username = 'admin' LIMIT 1;
SELECT id INTO @alice_user_id FROM accounts WHERE username = 'alice' LIMIT 1;
SELECT id INTO @bob_user_id FROM accounts WHERE username = 'bob' LIMIT 1;
SELECT id INTO @charlie_user_id FROM accounts WHERE username = 'charlie' LIMIT 1;
SELECT id INTO @dana_user_id FROM accounts WHERE username = 'dana' LIMIT 1;
SELECT id INTO @elena_user_id FROM accounts WHERE username = 'elena' LIMIT 1;
SELECT id INTO @farid_user_id FROM accounts WHERE username = 'farid' LIMIT 1;
SELECT id INTO @grace_user_id FROM accounts WHERE username = 'grace' LIMIT 1;

SELECT id INTO @admin_role_id FROM access_rights WHERE role_name = 'admin' LIMIT 1;
SELECT id INTO @user_role_id FROM access_rights WHERE role_name = 'user' LIMIT 1;
SELECT id INTO @operator_role_id FROM access_rights WHERE role_name = 'operator' LIMIT 1;

INSERT INTO user_access_rights (user_id, access_right_id)
VALUES
  (@admin_user_id, @admin_role_id),
  (@admin_user_id, @user_role_id),
  (@admin_user_id, @operator_role_id),
  (@alice_user_id, @user_role_id),
  (@alice_user_id, @operator_role_id),
  (@bob_user_id, @user_role_id),
  (@bob_user_id, @operator_role_id),
  (@charlie_user_id, @user_role_id),
  (@dana_user_id, @user_role_id),
  (@elena_user_id, @user_role_id),
  (@elena_user_id, @operator_role_id),
  (@farid_user_id, @user_role_id),
  (@grace_user_id, @user_role_id),
  (@grace_user_id, @operator_role_id);

INSERT INTO testwalls (name, ip_address)
VALUES
  ('Atlas-01', '192.168.10.11'),
  ('Atlas-02', '192.168.10.12'),
  ('Orion-03', '192.168.10.21'),
  ('Orion-04', '192.168.10.22'),
  ('Nova-05', '192.168.10.31'),
  ('Nova-06', '192.168.10.32');

SELECT id INTO @atlas_01_id FROM testwalls WHERE name = 'Atlas-01' LIMIT 1;
SELECT id INTO @atlas_02_id FROM testwalls WHERE name = 'Atlas-02' LIMIT 1;
SELECT id INTO @orion_03_id FROM testwalls WHERE name = 'Orion-03' LIMIT 1;
SELECT id INTO @orion_04_id FROM testwalls WHERE name = 'Orion-04' LIMIT 1;
SELECT id INTO @nova_05_id FROM testwalls WHERE name = 'Nova-05' LIMIT 1;
SELECT id INTO @nova_06_id FROM testwalls WHERE name = 'Nova-06' LIMIT 1;

SET @now := NOW();

INSERT INTO bookings (testwall_id, user_id, from_time, to_time, status)
VALUES
  (@atlas_01_id, @alice_user_id, DATE_SUB(@now, INTERVAL 2 DAY), DATE_ADD(DATE_SUB(@now, INTERVAL 2 DAY), INTERVAL 2 HOUR), 'finished'),
  (@atlas_01_id, @bob_user_id, DATE_ADD(@now, INTERVAL 1 DAY), DATE_ADD(DATE_ADD(@now, INTERVAL 1 DAY), INTERVAL 3 HOUR), 'active'),
  (@atlas_02_id, @charlie_user_id, DATE_ADD(@now, INTERVAL 2 DAY), DATE_ADD(DATE_ADD(@now, INTERVAL 2 DAY), INTERVAL 90 MINUTE), 'active'),
  (@atlas_02_id, @dana_user_id, DATE_ADD(@now, INTERVAL 4 DAY), DATE_ADD(DATE_ADD(@now, INTERVAL 4 DAY), INTERVAL 2 HOUR), 'active'),
  (@orion_03_id, @elena_user_id, DATE_SUB(@now, INTERVAL 1 DAY), DATE_ADD(DATE_SUB(@now, INTERVAL 1 DAY), INTERVAL 4 HOUR), 'forcequit'),
  (@orion_03_id, @farid_user_id, DATE_ADD(@now, INTERVAL 3 DAY), DATE_ADD(DATE_ADD(@now, INTERVAL 3 DAY), INTERVAL 2 HOUR), 'active'),
  (@orion_04_id, @grace_user_id, DATE_ADD(@now, INTERVAL 6 HOUR), DATE_ADD(@now, INTERVAL 8 HOUR), 'active'),
  (@nova_05_id, @alice_user_id, DATE_ADD(@now, INTERVAL 5 DAY), DATE_ADD(DATE_ADD(@now, INTERVAL 5 DAY), INTERVAL 2 HOUR), 'active'),
  (@nova_05_id, @bob_user_id, DATE_ADD(@now, INTERVAL 7 DAY), DATE_ADD(DATE_ADD(@now, INTERVAL 7 DAY), INTERVAL 90 MINUTE), 'crashed'),
  (@nova_06_id, @admin_user_id, DATE_ADD(@now, INTERVAL 1 DAY), DATE_ADD(DATE_ADD(@now, INTERVAL 1 DAY), INTERVAL 1 HOUR), 'active'),
  (@atlas_01_id, @grace_user_id, DATE_ADD(DATE_ADD(@now, INTERVAL 2 DAY), INTERVAL 5 HOUR), DATE_ADD(DATE_ADD(DATE_ADD(@now, INTERVAL 2 DAY), INTERVAL 5 HOUR), INTERVAL 2 HOUR), 'active'),
  (@atlas_02_id, @alice_user_id, DATE_ADD(DATE_ADD(@now, INTERVAL 3 DAY), INTERVAL 8 HOUR), DATE_ADD(DATE_ADD(DATE_ADD(@now, INTERVAL 3 DAY), INTERVAL 8 HOUR), INTERVAL 2 HOUR), 'active'),
  (@orion_03_id, @bob_user_id, DATE_ADD(DATE_ADD(@now, INTERVAL 4 DAY), INTERVAL 9 HOUR), DATE_ADD(DATE_ADD(DATE_ADD(@now, INTERVAL 4 DAY), INTERVAL 9 HOUR), INTERVAL 3 HOUR), 'active'),
  (@orion_04_id, @elena_user_id, DATE_ADD(DATE_ADD(@now, INTERVAL 5 DAY), INTERVAL 11 HOUR), DATE_ADD(DATE_ADD(DATE_ADD(@now, INTERVAL 5 DAY), INTERVAL 11 HOUR), INTERVAL 2 HOUR), 'finished'),
  (@nova_05_id, @farid_user_id, DATE_ADD(DATE_ADD(@now, INTERVAL 6 DAY), INTERVAL 7 HOUR), DATE_ADD(DATE_ADD(DATE_ADD(@now, INTERVAL 6 DAY), INTERVAL 7 HOUR), INTERVAL 4 HOUR), 'active'),
  (@nova_06_id, @charlie_user_id, DATE_ADD(DATE_ADD(@now, INTERVAL 8 DAY), INTERVAL 6 HOUR), DATE_ADD(DATE_ADD(DATE_ADD(@now, INTERVAL 8 DAY), INTERVAL 6 HOUR), INTERVAL 2 HOUR), 'active'),
  (@atlas_01_id, @admin_user_id, DATE_ADD(DATE_ADD(@now, INTERVAL 9 DAY), INTERVAL 10 HOUR), DATE_ADD(DATE_ADD(DATE_ADD(@now, INTERVAL 9 DAY), INTERVAL 10 HOUR), INTERVAL 2 HOUR), 'active'),
  (@atlas_02_id, @grace_user_id, DATE_ADD(DATE_ADD(@now, INTERVAL 10 DAY), INTERVAL 13 HOUR), DATE_ADD(DATE_ADD(DATE_ADD(@now, INTERVAL 10 DAY), INTERVAL 13 HOUR), INTERVAL 90 MINUTE), 'active'),
  (@orion_03_id, @alice_user_id, DATE_ADD(DATE_ADD(@now, INTERVAL 11 DAY), INTERVAL 9 HOUR), DATE_ADD(DATE_ADD(DATE_ADD(@now, INTERVAL 11 DAY), INTERVAL 9 HOUR), INTERVAL 2 HOUR), 'forcequit'),
  (@orion_04_id, @bob_user_id, DATE_ADD(DATE_ADD(@now, INTERVAL 12 DAY), INTERVAL 8 HOUR), DATE_ADD(DATE_ADD(DATE_ADD(@now, INTERVAL 12 DAY), INTERVAL 8 HOUR), INTERVAL 3 HOUR), 'active'),
  (@nova_05_id, @dana_user_id, DATE_ADD(DATE_ADD(@now, INTERVAL 13 DAY), INTERVAL 7 HOUR), DATE_ADD(DATE_ADD(DATE_ADD(@now, INTERVAL 13 DAY), INTERVAL 7 HOUR), INTERVAL 2 HOUR), 'active'),
  (@nova_06_id, @elena_user_id, DATE_ADD(DATE_ADD(@now, INTERVAL 14 DAY), INTERVAL 12 HOUR), DATE_ADD(DATE_ADD(DATE_ADD(@now, INTERVAL 14 DAY), INTERVAL 12 HOUR), INTERVAL 2 HOUR), 'crashed');

INSERT INTO logs (user_id, action, details, ip_address)
VALUES
  (@admin_user_id, 'seeded_database', 'Initial seed data loaded for local development', '127.0.0.1'),
  (@alice_user_id, 'created_booking', 'Booked Atlas-01 for a regression test session', '192.168.10.50'),
  (@bob_user_id, 'updated_profile', 'Changed timezone and location settings', '192.168.10.51'),
  (@charlie_user_id, 'viewed_testwalls', 'Checked available testwalls before booking', '192.168.10.52'),
  (@dana_user_id, 'created_booking', 'Reserved Atlas-02 for automation testing', '192.168.10.53'),
  (@elena_user_id, 'ran_command', 'Executed cleanup routine on Orion-03', '192.168.10.54'),
  (@farid_user_id, 'login_success', 'Signed in from the development environment', '192.168.10.55'),
  (@grace_user_id, 'checked_availability', 'Validated a window on Orion-04', '192.168.10.56');

INSERT INTO command_history (user_id, command)
VALUES
  (@admin_user_id, 'npm run server'),
  (@admin_user_id, 'npm run dev'),
  (@alice_user_id, 'book testwall Atlas-01 tomorrow 09:00 12:00'),
  (@alice_user_id, 'list bookings --user alice'),
  (@bob_user_id, 'check availability Atlas-02 next week'),
  (@charlie_user_id, 'export bookings --format csv'),
  (@dana_user_id, 'cancel booking 17'),
  (@elena_user_id, 'sync access-rights'),
  (@farid_user_id, 'ping testwall Orion-03'),
  (@grace_user_id, 'show logs --today');
