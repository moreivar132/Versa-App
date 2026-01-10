-- Sucursales
SELECT * FROM sucursal ORDER BY id;

-- Asignaciones actuales
SELECT us.id_usuario, u.nombre as tecnico, us.id_sucursal, s.nombre as sucursal
FROM usuario_sucursal us
JOIN usuario u ON us.id_usuario = u.id
JOIN sucursal s ON us.id_sucursal = s.id
ORDER BY s.nombre, u.nombre;
