document.addEventListener('DOMContentLoaded', async () => {
  const user = await Auth.requireAuth();
  if (!user) return;

  const isSuperAdmin = Boolean(user.is_super_admin);
  if (!isSuperAdmin) {
    alert('Acceso restringido a super administradores.');
    window.location.replace('index.html');
    return;
  }

  const userInfo = document.getElementById('userInfo');
  if (userInfo) {
    userInfo.textContent = `${user.nombre || user.email} · Administrador`;
  }
});
