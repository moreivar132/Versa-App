require('dotenv').config();

console.log('--- DIAGNOSTICO DE VARIABLES DE ENTORNO ---');
console.log('JWT_SECRET definida:', !!process.env.JWT_SECRET);
if (!process.env.JWT_SECRET) {
    console.log('⚠️  ALERTA: JWT_SECRET no está definida. El login fallará.');
} else {
    console.log('✅ JWT_SECRET está correcta.');
}
console.log('-------------------------------------------');
