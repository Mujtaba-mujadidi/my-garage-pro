-- Ensure every garage has rows for all product modules (new keys since Phase 1).
INSERT INTO garage_account_module (id, garage_account_id, module_key, enabled, created_at, updated_at)
SELECT gen_random_uuid(), ga.id, mk.module_key, false, NOW(), NOW()
FROM garage_account ga
CROSS JOIN (
  VALUES
    ('customers'),
    ('suppliers'),
    ('repair'),
    ('bodywork'),
    ('tyres'),
    ('parts'),
    ('invoices'),
    ('ledger'),
    ('used_cars'),
    ('rental'),
    ('pco'),
    ('partners'),
    ('reports')
) AS mk(module_key)
WHERE NOT EXISTS (
  SELECT 1
  FROM garage_account_module gam
  WHERE gam.garage_account_id = ga.id
    AND gam.module_key = mk.module_key
);

-- Demo garage (staging UAT): enable every module.
UPDATE garage_account_module gam
SET enabled = true, updated_at = NOW()
FROM garage_account ga
WHERE gam.garage_account_id = ga.id
  AND ga.slug = 'demo-garage';

-- Reset demo super admin password to "demo" (staging convenience; re-run safe).
UPDATE users
SET
  password_hash = '$argon2id$v=19$m=65536,t=3,p=4$gVzggFO/m5ZVOu2td+118w$SETGIHr44QzUYD5paBBykLhda6WOf+y+xO8L45h32ec',
  must_change_password = false,
  status = 'ACTIVE',
  deleted_at = NULL
WHERE email = 'admin@demo.garage';
