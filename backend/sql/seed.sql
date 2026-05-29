-- TN 15 seed data
-- Default fares
INSERT INTO fares (vehicle_type, base_fare, per_km)
VALUES
  ('bike', 30, 12),
  ('auto', 50, 18)
ON DUPLICATE KEY UPDATE
  base_fare = VALUES(base_fare),
  per_km = VALUES(per_km);

