-- Schema fingerprint (ADR-0005): one "kind|object|detail" line per fact, sorted.
-- Usage: docker exec -i <db container> psql -U postgres -d postgres -q -A -t -v ON_ERROR_STOP=1 < scripts/db/schema-fingerprint.sql
WITH facts(kind, obj, detail) AS (
  SELECT 'column', c.table_name || '.' || c.column_name,
         c.data_type || ' null=' || c.is_nullable || ' default=' || coalesce(c.column_default, '')
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
UNION ALL
  SELECT 'constraint', cl.relname || '.' || con.conname, pg_get_constraintdef(con.oid)
  FROM pg_constraint con
  JOIN pg_class cl ON cl.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = cl.relnamespace
  WHERE n.nspname = 'public'
UNION ALL
  SELECT 'index', i.tablename || '.' || i.indexname, i.indexdef
  FROM pg_indexes i
  WHERE i.schemaname = 'public'
UNION ALL
  SELECT 'rls', cl.relname, 'enabled=' || cl.relrowsecurity || ' forced=' || cl.relforcerowsecurity
  FROM pg_class cl
  JOIN pg_namespace n ON n.oid = cl.relnamespace
  WHERE n.nspname = 'public' AND cl.relkind IN ('r', 'p')
UNION ALL
  SELECT 'policy', p.tablename || '.' || p.policyname,
         p.cmd || ' roles=' || array_to_string(p.roles, ',') ||
         ' using=' || coalesce(p.qual, '') || ' check=' || coalesce(p.with_check, '')
  FROM pg_policies p
  WHERE p.schemaname = 'public'
UNION ALL
  SELECT 'table_grant', cl.relname || '.' || r.rolname,
         string_agg(a.privilege_type, ',' ORDER BY a.privilege_type)
  FROM pg_class cl
  JOIN pg_namespace n ON n.oid = cl.relnamespace
  CROSS JOIN LATERAL aclexplode(coalesce(cl.relacl, acldefault('r', cl.relowner))) a
  JOIN pg_roles r ON r.oid = a.grantee
  WHERE n.nspname = 'public' AND cl.relkind IN ('r', 'p', 'v', 'm', 'S')
    AND r.rolname IN ('anon', 'authenticated', 'service_role')
  GROUP BY cl.relname, r.rolname
UNION ALL
  SELECT 'column_grant', cl.relname || '.' || att.attname || '.' || r.rolname,
         string_agg(a.privilege_type, ',' ORDER BY a.privilege_type)
  FROM pg_attribute att
  JOIN pg_class cl ON cl.oid = att.attrelid
  JOIN pg_namespace n ON n.oid = cl.relnamespace
  CROSS JOIN LATERAL aclexplode(att.attacl) a
  JOIN pg_roles r ON r.oid = a.grantee
  WHERE n.nspname = 'public' AND att.attacl IS NOT NULL
    AND r.rolname IN ('anon', 'authenticated', 'service_role')
  GROUP BY cl.relname, att.attname, r.rolname
UNION ALL
  SELECT 'function', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
         'returns=' || pg_get_function_result(p.oid) || ' secdef=' || p.prosecdef ||
         ' config=' || coalesce(array_to_string(p.proconfig, ';'), '') || ' body=' || md5(p.prosrc)
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prokind = 'f'
UNION ALL
  SELECT 'function_grant', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ').' || r.rolname,
         CASE WHEN has_function_privilege(r.oid, p.oid, 'EXECUTE') THEN 'EXECUTE' ELSE 'none' END
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  CROSS JOIN pg_roles r
  WHERE n.nspname = 'public' AND p.prokind = 'f'
    AND r.rolname IN ('anon', 'authenticated', 'service_role')
UNION ALL
  SELECT 'trigger', cl.relname || '.' || t.tgname, pg_get_triggerdef(t.oid)
  FROM pg_trigger t
  JOIN pg_class cl ON cl.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = cl.relnamespace
  WHERE NOT t.tgisinternal
    AND (n.nspname = 'public' OR (n.nspname = 'auth' AND cl.relname = 'users'))
UNION ALL
  SELECT 'view', v.table_name, md5(v.view_definition)
  FROM information_schema.views v
  WHERE v.table_schema = 'public'
UNION ALL
  SELECT 'default_acl',
         pg_get_userbyid(d.defaclrole) || '.' || coalesce(dn.nspname, '*') || '.' || d.defaclobjtype,
         array_to_string(d.defaclacl, ',')
  FROM pg_default_acl d
  LEFT JOIN pg_namespace dn ON dn.oid = d.defaclnamespace
)
SELECT kind || '|' || obj || '|' || detail FROM facts ORDER BY 1;
