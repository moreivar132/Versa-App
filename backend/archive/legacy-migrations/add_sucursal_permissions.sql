-- Add permissions for Sucursales module
INSERT INTO permiso (nombre, key, module, descripcion, created_at)
SELECT * FROM (VALUES 
    ('sucursales.view', 'sucursales.view', 'sucursales', 'View branches list', NOW()),
    ('sucursales.manage', 'sucursales.manage', 'sucursales', 'Create, update and delete branches', NOW())
) AS v(nombre, key, module, descripcion, created_at)
WHERE NOT EXISTS (
    SELECT 1 FROM permiso p WHERE p.key = v.key
);

-- Grant these permissions to all existing 'Administrador' roles
INSERT INTO rolpermiso (id_rol, id_permiso)
SELECT r.id, p.id
FROM rol r
CROSS JOIN permiso p
WHERE r.nombre = 'Administrador'
  AND p.key IN ('sucursales.view', 'sucursales.manage')
  AND NOT EXISTS (
      SELECT 1 FROM rolpermiso rp 
      WHERE rp.id_rol = r.id AND rp.id_permiso = p.id
  );
