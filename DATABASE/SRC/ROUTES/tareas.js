const express = require('express');
const router = express.Router();
const { promisePool } = require('../CONFIG/database');
const authenticateToken = require('../MIDDLEWARE/auth');
let io;

router.setSocketIO = (socketIO) => {
    io = socketIO;
    console.log('✅ Socket.IO configurado en tareas.js');
};

// 📋 CREAR NUEVA TAREA
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { id_grupo, titulo, descripcion, asignado_a } = req.body;
        const userId = req.user.id;

        // Validaciones
        if (!id_grupo || !titulo || !asignado_a) {
            return res.status(400).json({
                success: false,
                error: 'Faltan datos requeridos'
            });
        }

        // Verificar que el usuario sea miembro del grupo
        const [miembro] = await promisePool.query(
            'SELECT id_miembro, rol FROM miembros_grupo WHERE id_grupo = ? AND id_usuario = ?',
            [id_grupo, userId]
        );

        if (miembro.length === 0) {
            return res.status(403).json({
                success: false,
                error: 'No tienes acceso a este grupo'
            });
        }

        // Verificar que el usuario asignado sea miembro del grupo
        const [asignadoMiembro] = await promisePool.query(
            'SELECT id_miembro FROM miembros_grupo WHERE id_grupo = ? AND id_usuario = ?',
            [id_grupo, asignado_a]
        );

        if (asignadoMiembro.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'El usuario asignado no es miembro del grupo'
            });
        }

        // Crear tarea
        const [result] = await promisePool.query(`
            INSERT INTO tareas (id_grupo, titulo, descripcion, asignado_a, estado)
            VALUES (?, ?, ?, ?, 'pendiente')
        `, [id_grupo, titulo, descripcion || null, asignado_a]);

        const tareaId = result.insertId;

        // Obtener información completa de la tarea creada
        const [tareaCreada] = await promisePool.query(`
            SELECT 
                t.*,
                u_asignado.nombre as nombre_asignado,
                u_asignado.nombreUsuario as nombreUsuario_asignado,
                g.nombre as nombre_grupo
            FROM tareas t
            INNER JOIN usuarios u_asignado ON t.asignado_a = u_asignado.id_usuario
            INNER JOIN grupos g ON t.id_grupo = g.id_grupo
            WHERE t.id_tarea = ?
        `, [tareaId]);

        const tarea = tareaCreada[0];

        // 🔥 EMITIR POR WEBSOCKET A TODOS LOS MIEMBROS DEL GRUPO
        if (io) {
            // Obtener el chat_id asociado al grupo
            const [chatInfo] = await promisePool.query(
                'SELECT id_chat FROM chats WHERE id_grupo = ?',
                [id_grupo]
            );

            if (chatInfo.length > 0) {
                const chatId = chatInfo[0].id_chat;
                
                io.to(`chat-${chatId}`).emit('nueva-tarea', {
                    tarea: {
                        id: tarea.id_tarea,
                        titulo: tarea.titulo,
                        descripcion: tarea.descripcion,
                        asignado_a: tarea.asignado_a,
                        nombre_asignado: tarea.nombre_asignado,
                        nombreUsuario_asignado: tarea.nombreUsuario_asignado,
                        estado: tarea.estado,
                        fecha_creacion: tarea.fecha_creacion,
                        id_grupo: tarea.id_grupo,
                        nombre_grupo: tarea.nombre_grupo
                    },
                    chatId: chatId
                });

                console.log(`📋 Tarea emitida al chat-${chatId}`);
            }
        }

        res.json({
            success: true,
            tarea: tarea
        });

    } catch (error) {
        console.error('❌ Error creando tarea:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

// 📋 OBTENER TAREAS DE UN GRUPO
router.get('/grupo/:grupoId', authenticateToken, async (req, res) => {
    try {
        const { grupoId } = req.params;
        const userId = req.user.id;

        // Verificar acceso al grupo
        const [miembro] = await promisePool.query(
            'SELECT id_miembro FROM miembros_grupo WHERE id_grupo = ? AND id_usuario = ?',
            [grupoId, userId]
        );

        if (miembro.length === 0) {
            return res.status(403).json({
                success: false,
                error: 'No tienes acceso a este grupo'
            });
        }

        // Obtener tareas
        const [tareas] = await promisePool.query(`
            SELECT 
                t.*,
                u_asignado.nombre as nombre_asignado,
                u_asignado.nombreUsuario as nombreUsuario_asignado
            FROM tareas t
            INNER JOIN usuarios u_asignado ON t.asignado_a = u_asignado.id_usuario
            WHERE t.id_grupo = ?
            ORDER BY 
                CASE t.estado
                    WHEN 'pendiente' THEN 1
                    WHEN 'en_progreso' THEN 2
                    WHEN 'terminada' THEN 3
                END,
                t.fecha_creacion DESC
        `, [grupoId]);

        res.json({
            success: true,
            tareas: tareas
        });

    } catch (error) {
        console.error('❌ Error obteniendo tareas:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

// ✅ NUEVO: Obtener tareas de un CHAT (en lugar de grupo directamente)
router.get('/chat/:chatId', authenticateToken, async (req, res) => {
    try {
        const { chatId } = req.params;
        const userId = req.user.id;

        console.log(`📋 Solicitando tareas para chat: ${chatId}, usuario: ${userId}`);

        // Verificar que el usuario tenga acceso al chat
        const [acceso] = await promisePool.query(
            'SELECT id_participante FROM participantes_chat WHERE id_chat = ? AND id_usuario = ?',
            [chatId, userId]
        );

        if (acceso.length === 0) {
            return res.status(403).json({
                success: false,
                error: 'No tienes acceso a este chat'
            });
        }

        // Obtener el id_grupo del chat
        const [chatInfo] = await promisePool.query(
            'SELECT id_grupo FROM chats WHERE id_chat = ? AND tipo = "grupal"',
            [chatId]
        );

        if (chatInfo.length === 0 || !chatInfo[0].id_grupo) {
            return res.json({
                success: true,
                tareas: [] // No hay tareas si no es un chat grupal
            });
        }

        const grupoId = chatInfo[0].id_grupo;

        // Obtener tareas del grupo
        const [tareas] = await promisePool.query(`
            SELECT 
                t.id_tarea as id,
                t.titulo,
                t.descripcion,
                t.asignado_a,
                t.estado,
                t.fecha_creacion,
                t.fecha_termino,
                u_asignado.nombre as nombre_asignado,
                u_asignado.nombreUsuario as nombreUsuario_asignado
            FROM tareas t
            INNER JOIN usuarios u_asignado ON t.asignado_a = u_asignado.id_usuario
            WHERE t.id_grupo = ?
            ORDER BY 
                CASE t.estado
                    WHEN 'pendiente' THEN 1
                    WHEN 'en_progreso' THEN 2
                    WHEN 'terminada' THEN 3
                END,
                t.fecha_creacion DESC
        `, [grupoId]);

        console.log(`✅ ${tareas.length} tareas encontradas para el grupo ${grupoId}`);

        res.json({
            success: true,
            tareas: tareas
        });

    } catch (error) {
        console.error('❌ Error obteniendo tareas del chat:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

// ✅ ACTUALIZAR ESTADO DE TAREA
router.put('/:tareaId/estado', authenticateToken, async (req, res) => {
    try {
        const { tareaId } = req.params;
        const { estado } = req.body;
        const userId = req.user.id;

        // Validar estado
        const estadosValidos = ['pendiente', 'en_progreso', 'terminada'];
        if (!estadosValidos.includes(estado)) {
            return res.status(400).json({
                success: false,
                error: 'Estado inválido'
            });
        }

        // Obtener información de la tarea
        const [tarea] = await promisePool.query(
            'SELECT * FROM tareas WHERE id_tarea = ?',
            [tareaId]
        );

        if (tarea.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Tarea no encontrada'
            });
        }

        const tareaActual = tarea[0];

        // Verificar que el usuario sea el asignado o sea miembro del grupo
        const [miembro] = await promisePool.query(
            'SELECT id_miembro, rol FROM miembros_grupo WHERE id_grupo = ? AND id_usuario = ?',
            [tareaActual.id_grupo, userId]
        );

        if (miembro.length === 0) {
            return res.status(403).json({
                success: false,
                error: 'No tienes acceso a esta tarea'
            });
        }

        // Actualizar estado
        const fechaTermino = estado === 'terminada' ? new Date() : null;
        
        await promisePool.query(`
            UPDATE tareas 
            SET estado = ?, fecha_termino = ?
            WHERE id_tarea = ?
        `, [estado, fechaTermino, tareaId]);

        // Obtener tarea actualizada
        const [tareaActualizada] = await promisePool.query(`
            SELECT 
                t.id_tarea as id,
                t.titulo,
                t.descripcion,
                t.asignado_a,
                t.estado,
                t.fecha_creacion,
                t.fecha_termino,
                u_asignado.nombre as nombre_asignado,
                u_asignado.nombreUsuario as nombreUsuario_asignado
            FROM tareas t
            INNER JOIN usuarios u_asignado ON t.asignado_a = u_asignado.id_usuario
            WHERE t.id_tarea = ?
        `, [tareaId]);

        // 🔥 EMITIR ACTUALIZACIÓN POR WEBSOCKET
        if (io) {
            const [chatInfo] = await promisePool.query(
                'SELECT id_chat FROM chats WHERE id_grupo = ?',
                [tareaActual.id_grupo]
            );

            if (chatInfo.length > 0) {
                const chatId = chatInfo[0].id_chat;
                
                io.to(`chat-${chatId}`).emit('tarea-actualizada', {
                    tarea: tareaActualizada[0],
                    chatId: chatId
                });

                console.log(`✅ Estado de tarea ${tareaId} actualizado a ${estado} y emitido al chat-${chatId}`);
            }
        }

        res.json({
            success: true,
            tarea: tareaActualizada[0]
        });

    } catch (error) {
        console.error('❌ Error actualizando tarea:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

// 🗑️ ELIMINAR TAREA
router.delete('/:tareaId', authenticateToken, async (req, res) => {
    try {
        const { tareaId } = req.params;
        const userId = req.user.id;

        // Obtener información de la tarea
        const [tarea] = await promisePool.query(
            'SELECT * FROM tareas WHERE id_tarea = ?',
            [tareaId]
        );

        if (tarea.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Tarea no encontrada'
            });
        }

        const tareaActual = tarea[0];

        // Verificar que el usuario sea admin del grupo
        const [miembro] = await promisePool.query(
            'SELECT id_miembro, rol FROM miembros_grupo WHERE id_grupo = ? AND id_usuario = ?',
            [tareaActual.id_grupo, userId]
        );

        if (miembro.length === 0 || miembro[0].rol !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Solo los administradores pueden eliminar tareas'
            });
        }

        // Eliminar tarea
        await promisePool.query('DELETE FROM tareas WHERE id_tarea = ?', [tareaId]);

        // 🔥 EMITIR ELIMINACIÓN POR WEBSOCKET
        if (io) {
            const [chatInfo] = await promisePool.query(
                'SELECT id_chat FROM chats WHERE id_grupo = ?',
                [tareaActual.id_grupo]
            );

            if (chatInfo.length > 0) {
                const chatId = chatInfo[0].id_chat;
                
                io.to(`chat-${chatId}`).emit('tarea-eliminada', {
                    tareaId: tareaId,
                    chatId: chatId
                });

                console.log(`🗑️ Tarea ${tareaId} eliminada`);
            }
        }

        res.json({
            success: true,
            message: 'Tarea eliminada exitosamente'
        });

    } catch (error) {
        console.error('❌ Error eliminando tarea:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

module.exports = router;