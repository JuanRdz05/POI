const express = require('express');
const router = express.Router();
const { promisePool } = require('../CONFIG/database');
const bcrypt = require('bcrypt');
const multer = require('multer');

const authenticateToken = require('../MIDDLEWARE/auth');

// ENDPOINT PARA OBTENER PERFIL COMPLETO
router.get('/full-profile', authenticateToken, async (req, res) => {
    try {
        console.log("✅ Profile endpoint ejecutándose correctamente");
        const userId = req.user.id;
        
        console.log('Usuario solicitando perfil:', userId);

        // OBTENER USUARIO COMPLETO CON TODAS LAS COLUMNAS
        const [users] = await promisePool.query(
            `SELECT 
                id_usuario, nombre, apellidoPaterno, apellidoMaterno, 
                nombreUsuario, correo, genero, fechaNacimiento, 
                foto, id_pais, estado_conexion, ubicacion, recompensa_total, fecha_registro
            FROM usuarios WHERE id_usuario = ?`,
            [userId]  
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const user = users[0];
        console.log('Datos completos del usuario desde BD:', user);

        // OBTENER NOMBRE DEL PAÍS SI EXISTE id_pais
        let paisNombre = null;
        if (user.id_pais) {
            try {
                const [paisData] = await promisePool.query(
                    'SELECT nombre FROM pais WHERE id = ?',
                    [user.id_pais]
                );
                if (paisData.length > 0) {
                    paisNombre = paisData[0].nombre;
                }
            } catch (paisError) {
                console.log('Error obteniendo país:', paisError);
            }
        }

        // ENVIAR DATOS COMPLETOS
        res.json({
            id: user.id_usuario,
            nombre: user.nombre,
            apellidoPaterno: user.apellidoPaterno,
            apellidoMaterno: user.apellidoMaterno,
            email: user.correo,
            foto: user.foto,
            nombreUsuario: user.nombreUsuario,
            genero: user.genero,
            fechaNacimiento: user.fechaNacimiento,
            pais: paisNombre,
            id_pais: user.id_pais,
            estado_conexion: user.estado_conexion,
            ubicacion: user.ubicacion,
            recompensa_total: user.recompensa_total,
            fecha_registro: user.fecha_registro
        });

    } catch (error) {
        console.log('Error obteniendo perfil:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// 🔥 ENDPOINT PUT PARA ACTUALIZAR PERFIL - VERSIÓN CORREGIDA
// 🔥 ENDPOINT PUT PARA ACTUALIZAR PERFIL - VERSIÓN CORREGIDA
router.put('/full-profile', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id_usuario;
        const { 
            nombre, 
            apellidoPaterno, 
            apellidoMaterno, 
            email, 
            genero, 
            fechaNacimiento, 
            id_pais 
        } = req.body;

        console.log('📄 Actualizando perfil para usuario:', userId);
        console.log('📦 Datos recibidos:', req.body);

        // Validar campos obligatorios
        if (!nombre || !email) {
            return res.status(400).json({ 
                error: 'Nombre y email son campos obligatorios' 
            });
        }

        // Verificar que el email no esté en uso por otro usuario
        const [existingUsers] = await promisePool.query(
            'SELECT id_usuario FROM usuarios WHERE correo = ? AND id_usuario != ?',
            [email, userId]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({ 
                error: 'El correo electrónico ya está en uso por otro usuario' 
            });
        }

        // ✅ Obtener datos actuales del usuario
        const [currentUser] = await promisePool.query(
            'SELECT * FROM usuarios WHERE id_usuario = ?',
            [userId]
        );

        if (currentUser.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const user = currentUser[0];

        // Construir query dinámica para actualización
        const updateFields = [];
        const updateValues = [];

        // ✅ Campos que SIEMPRE se actualizan
        updateFields.push('nombre = ?'); 
        updateValues.push(nombre);

        updateFields.push('correo = ?'); 
        updateValues.push(email);

        // ✅ Campos opcionales - solo actualizar si vienen en el request
        if (apellidoPaterno !== undefined) {
            updateFields.push('apellidoPaterno = ?');
            updateValues.push(apellidoPaterno);
        }

        if (apellidoMaterno !== undefined) {
            updateFields.push('apellidoMaterno = ?');
            updateValues.push(apellidoMaterno);
        }

        if (genero !== undefined && genero !== '') {
            updateFields.push('genero = ?');
            updateValues.push(genero);
        }

        // ✅ CRÍTICO: Solo actualizar fecha si viene explícitamente en el request
        if (fechaNacimiento !== undefined && fechaNacimiento !== null && fechaNacimiento !== '') {
            updateFields.push('fechaNacimiento = ?');
            updateValues.push(fechaNacimiento);
        }

        // ✅ Solo actualizar país si viene explícitamente en el request
        if (id_pais !== undefined && id_pais !== null && id_pais !== '') {
            updateFields.push('id_pais = ?');
            updateValues.push(id_pais);
        }

        // Agregar el ID al final para el WHERE
        updateValues.push(userId);

        const updateQuery = `
            UPDATE usuarios 
            SET ${updateFields.join(', ')}
            WHERE id_usuario = ?
        `;

        console.log('🔍 Query de actualización:', updateQuery);
        console.log('🎯 Valores:', updateValues);

        const [result] = await promisePool.query(updateQuery, updateValues);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        console.log('✅ Perfil actualizado correctamente');
        res.json({ 
            message: 'Perfil actualizado correctamente',
            success: true 
        });

    } catch (error) {
        console.error('❌ Error actualizando perfil:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor al actualizar el perfil',
            details: error.message 
        });
    }
});

// ENDPOINT PARA CAMBIAR CONTRASEÑA
router.put('/change-password', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { currentPassword, newPassword, confirmPassword } = req.body;

        console.log('🔐 Cambiando contraseña para usuario:', userId);

        // Validar campos
        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({ 
                error: 'Todos los campos son obligatorios' 
            });
        }

        // Verificar que las nuevas contraseñas coincidan
        if (newPassword !== confirmPassword) {
            return res.status(400).json({ 
                error: 'Las nuevas contraseñas no coinciden' 
            });
        }

        // Verificar longitud mínima de la nueva contraseña
        if (newPassword.length < 6) {
            return res.status(400).json({ 
                error: 'La nueva contraseña debe tener al menos 6 caracteres' 
            });
        }

        // Obtener la contraseña actual del usuario
        const [users] = await promisePool.query(
            'SELECT contrasena FROM usuarios WHERE id_usuario = ?',
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const user = users[0];

        // Verificar la contraseña actual
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.contrasena);
        
        if (!isCurrentPasswordValid) {
            return res.status(400).json({ 
                error: 'La contraseña actual es incorrecta' 
            });
        }

        // Hashear la nueva contraseña
        const saltRounds = 10;
        const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

        // Actualizar la contraseña en la base de datos
        const [result] = await promisePool.query(
            'UPDATE usuarios SET contrasena = ? WHERE id_usuario = ?',
            [hashedNewPassword, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        console.log('✅ Contraseña actualizada correctamente');
        res.json({ 
            message: 'Contraseña actualizada correctamente',
            success: true 
        });

    } catch (error) {
        console.error('❌ Error cambiando contraseña:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor al cambiar la contraseña',
            details: error.message 
        });
    }
});

module.exports = router;