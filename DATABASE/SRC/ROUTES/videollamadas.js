// ROUTES/videollamadas.js - Gestión de Videollamadas (VERSIÓN CORREGIDA)
const express = require('express');
const router = express.Router();
const { promisePool } = require('../CONFIG/database');
const authenticateToken = require('../MIDDLEWARE/auth');

let io; // Socket.IO instance

// Configurar Socket.IO
function setSocketIO(socketIO) {
    io = socketIO;
}

// 📞 INICIAR LLAMADA
router.post('/iniciar', authenticateToken, async (req, res) => {
    try {
        const { id_receptor, tipo } = req.body; // tipo: 'audio' o 'video'
        
        // 🔥 CORREGIDO: Obtener id del usuario logueado (compatible con ambos formatos)
        const id_emisor = req.user.id_usuario || req.user.id;

        // Verificar que no sea el mismo usuario
        if (id_emisor === id_receptor) {
            return res.status(400).json({ error: 'No puedes llamarte a ti mismo' });
        }

        // 🔥 CORREGIDO: Usar tabla "usuarios" con "id_usuario"
        const [receptor] = await promisePool.query(
            'SELECT id_usuario as id, nombre, foto FROM usuarios WHERE id_usuario = ?',
            [id_receptor]
        );

        if (receptor.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // Crear registro de videollamada
        const [result] = await promisePool.query(
            `INSERT INTO videollamadas (id_emisor, id_receptor, inicio, estado) 
             VALUES (?, ?, NOW(), 'en_progreso')`,
            [id_emisor, id_receptor]
        );

        const id_videollamada = result.insertId;

        // 🔥 CORREGIDO: Obtener datos del emisor
        const [emisor] = await promisePool.query(
            'SELECT id_usuario as id, nombre, foto FROM usuarios WHERE id_usuario = ?',
            [id_emisor]
        );

        // 📡 EMITIR EVENTO DE LLAMADA ENTRANTE AL RECEPTOR
        if (io) {
            io.to(`user-${id_receptor}`).emit('incoming-call', {
                callId: id_videollamada,
                from: {
                    id: emisor[0].id,
                    nombre: emisor[0].nombre,
                    foto: emisor[0].foto
                },
                tipo: tipo || 'audio',
                timestamp: Date.now()
            });
            console.log(`📞 Llamada iniciada: ${id_emisor} → ${id_receptor}`);
        }

        res.json({
            success: true,
            callId: id_videollamada,
            receptor: receptor[0],
            message: 'Llamada iniciada'
        });

    } catch (error) {
        console.error('❌ Error iniciando llamada:', error);
        res.status(500).json({ error: 'Error al iniciar llamada' });
    }
});

// ✅ ACEPTAR LLAMADA
router.post('/aceptar/:callId', authenticateToken, async (req, res) => {
    try {
        const { callId } = req.params;
        const userId = req.user.id_usuario || req.user.id;

        // Verificar que el usuario sea el receptor
        const [llamada] = await promisePool.query(
            `SELECT id_videollamada, id_emisor, id_receptor, estado 
             FROM videollamadas
             WHERE id_videollamada = ? AND id_receptor = ?`,
            [callId, userId]
        );

        if (llamada.length === 0) {
            return res.status(404).json({ error: 'Llamada no encontrada' });
        }

        if (llamada[0].estado !== 'en_progreso') {
            return res.status(400).json({ error: 'La llamada ya no está activa' });
        }

        // 📡 NOTIFICAR AL EMISOR QUE SE ACEPTÓ LA LLAMADA
        if (io) {
            io.to(`user-${llamada[0].id_emisor}`).emit('call-accepted', {
                callId: callId,
                acceptedBy: userId
            });
            console.log(`✅ Llamada ${callId} aceptada`);
        }

        res.json({
            success: true,
            callId: callId,
            id_emisor: llamada[0].id_emisor,
            message: 'Llamada aceptada'
        });

    } catch (error) {
        console.error('❌ Error aceptando llamada:', error);
        res.status(500).json({ error: 'Error al aceptar llamada' });
    }
});

// ❌ RECHAZAR LLAMADA
router.post('/rechazar/:callId', authenticateToken, async (req, res) => {
    try {
        const { callId } = req.params;
        const userId = req.user.id_usuario || req.user.id;

        // Actualizar estado de la llamada
        const [result] = await promisePool.query(
            `UPDATE videollamadas
             SET estado = 'cancelada', fin = NOW() 
             WHERE id_videollamada = ? AND (id_emisor = ? OR id_receptor = ?)`,
            [callId, userId, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Llamada no encontrada' });
        }

        // Obtener el otro usuario (emisor o receptor)
        const [llamada] = await promisePool.query(
            'SELECT id_emisor, id_receptor FROM videollamadas WHERE id_videollamada = ?',
            [callId]
        );

        const otroUsuario = llamada[0].id_emisor === userId ? 
            llamada[0].id_receptor : llamada[0].id_emisor;

        // 📡 NOTIFICAR AL OTRO USUARIO
        if (io) {
            io.to(`user-${otroUsuario}`).emit('call-rejected', {
                callId: callId,
                rejectedBy: userId
            });
            console.log(`❌ Llamada ${callId} rechazada`);
        }

        res.json({
            success: true,
            message: 'Llamada rechazada'
        });

    } catch (error) {
        console.error('❌ Error rechazando llamada:', error);
        res.status(500).json({ error: 'Error al rechazar llamada' });
    }
});

// 🔚 FINALIZAR LLAMADA
router.post('/finalizar/:callId', authenticateToken, async (req, res) => {
    try {
        const { callId } = req.params;
        const userId = req.user.id_usuario || req.user.id;

        // Actualizar estado de la llamada
        const [result] = await promisePool.query(
            `UPDATE videollamadas 
             SET estado = 'finalizada', fin = NOW() 
             WHERE id_videollamada = ? AND (id_emisor = ? OR id_receptor = ?)`,
            [callId, userId, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Llamada no encontrada' });
        }

        // Obtener el otro usuario
        const [llamada] = await promisePool.query(
            'SELECT id_emisor, id_receptor FROM videollamadas WHERE id_videollamada = ?',
            [callId]
        );

        const otroUsuario = llamada[0].id_emisor === userId ? 
            llamada[0].id_receptor : llamada[0].id_emisor;

        // 📡 NOTIFICAR AL OTRO USUARIO
        if (io) {
            io.to(`user-${otroUsuario}`).emit('call-ended', {
                callId: callId,
                endedBy: userId
            });
            console.log(`🔚 Llamada ${callId} finalizada`);
        }

        res.json({
            success: true,
            message: 'Llamada finalizada'
        });

    } catch (error) {
        console.error('❌ Error finalizando llamada:', error);
        res.status(500).json({ error: 'Error al finalizar llamada' });
    }
});

// 📊 OBTENER HISTORIAL DE LLAMADAS
router.get('/historial', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id_usuario || req.user.id;

        // 🔥 CORREGIDO: Usar tabla "usuarios" con "id_usuario"
        const [llamadas] = await promisePool.query(
            `SELECT 
                v.id_videollamada,
                v.id_emisor,
                v.id_receptor,
                v.inicio,
                v.fin,
                v.estado,
                CASE 
                    WHEN v.id_emisor = ? THEN u2.nombre
                    ELSE u1.nombre
                END as otro_usuario,
                CASE 
                    WHEN v.id_emisor = ? THEN u2.foto
                    ELSE u1.foto
                END as foto_otro_usuario,
                CASE 
                    WHEN v.id_emisor = ? THEN 'saliente'
                    ELSE 'entrante'
                END as tipo_llamada,
                TIMESTAMPDIFF(SECOND, v.inicio, v.fin) as duracion
             FROM videollamadas v
             JOIN usuarios u1 ON v.id_emisor = u1.id_usuario
             JOIN usuarios u2 ON v.id_receptor = u2.id_usuario
             WHERE v.id_emisor = ? OR v.id_receptor = ?
             ORDER BY v.inicio DESC
             LIMIT 50`,
            [userId, userId, userId, userId, userId]
        );

        res.json({
            success: true,
            llamadas: llamadas
        });

    } catch (error) {
        console.error('❌ Error obteniendo historial:', error);
        res.status(500).json({ error: 'Error al obtener historial' });
    }
});

module.exports = router;
module.exports.setSocketIO = setSocketIO;