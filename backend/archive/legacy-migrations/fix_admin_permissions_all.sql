-- Grant ALL core permissions to existing 'Administrador' roles
INSERT INTO rolpermiso (id_rol, id_permiso)
SELECT r.id, p.id
FROM rol r
CROSS JOIN permiso p
WHERE r.nombre = 'Administrador'
  -- Grant everything except maybe specific system ones if we had any restrictive policy, but for Admin we usually want all
  AND NOT EXISTS (
      SELECT 1 FROM rolpermiso rp 
      WHERE rp.id_rol = r.id AND rp.id_permiso = p.id
  );
