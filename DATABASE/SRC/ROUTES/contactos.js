// contactos.js
const express = require('express');
const router = express.Router();
const { promisePool } = require('../CONFIG/database');
const authenticateToken = require('../MIDDLEWARE/auth');

// OBTENER TODOS LOS USUARIOS (excepto el usuario actual)
router.get('/usuarios', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        const [usuarios] = await promisePool.query(
            `SELECT 
                id_usuario, 
                nombre,
                apellidoPaterno,
                apellidoMaterno,
                nombreUsuario,
                foto,
                estado_conexion
            FROM usuarios 
            WHERE id_usuario != ? 
            ORDER BY nombre`,
            [userId]
        );

        // Formatear los datos para el frontend
        const usuariosFormateados = usuarios.map(usuario => ({
            id: usuario.id_usuario,
            nombre: `${usuario.nombre} ${usuario.apellidoPaterno || ''} ${usuario.apellidoMaterno || ''}`.trim(),
            nombreUsuario: usuario.nombreUsuario,
            foto: usuario.foto,
            online: usuario.estado_conexion === 'online',
            // Generar avatar iniciales si no hay foto
            avatar: usuario.foto ? null : 
                (usuario.nombre.charAt(0) + (usuario.apellidoPaterno ? usuario.apellidoPaterno.charAt(0) : usuario.nombre.charAt(0))).toUpperCase()
        }));

        res.json({
            success: true,
            usuarios: usuariosFormateados
        });

    } catch (error) {
        console.log('Error obteniendo usuarios:', error);
        res.status(500).json({ 
            success: false,
            error: 'Error interno del servidor' 
        });
    }
});

// OBTENER CONTACTOS DEL USUARIO
router.get('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Aquí puedes implementar la lógica para obtener los contactos guardados del usuario
        // Por ahora devolveremos un array vacío
        res.json({
            success: true,
            contactos: []
        });

    } catch (error) {
        console.log('Error obteniendo contactos:', error);
        res.status(500).json({ 
            success: false,
            error: 'Error interno del servidor' 
        });
    }
});

// AGREGAR CONTACTO
router.post('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { contactoId } = req.body;
        
        // Aquí puedes implementar la lógica para guardar el contacto
        // Por ahora solo devolvemos éxito
        
        res.json({
            success: true,
            message: 'Contacto agregado correctamente'
        });

    } catch (error) {
        console.log('Error agregando contacto:', error);
        res.status(500).json({ 
            success: false,
            error: 'Error interno del servidor' 
        });
    }
});

module.exports = router;