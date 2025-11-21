// middleware/auth.js
const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Token requerido' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'tu_clave_secreta', (err, decoded) => {
        if (err) {
            console.error('❌ Error verificando token:', err.message);
            return res.status(403).json({ error: 'Token inválido' });
        }
        
        // ✅ NORMALIZAR: El token tiene "id" pero los endpoints esperan "id_usuario"
        req.user = {
            ...decoded,
            id_usuario: decoded.id || decoded.id_usuario  // Mapear id → id_usuario
        };
        
        // 🔍 DEBUG (opcional - puedes comentar después)
        console.log('👤 Usuario autenticado:', {
            id_usuario: req.user.id_usuario,
            nombreUsuario: req.user.nombreUsuario
        });
        
        next();
    });
};

module.exports = authenticateToken;