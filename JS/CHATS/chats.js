const express = require('express');
const router = express.Router();
const { promisePool } = require('../CONFIG/database');
const authenticateToken = require('../MIDDLEWARE/auth');

// 🔥 NUEVO: Función para obtener el io desde el servidor
let io;
const setSocketIO = (socketIO) => {
    io = socketIO;
};

// OBTENER CHATS DEL USUARIO
router.get('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        const [chats] = await promisePool.query(`
            SELECT DISTINCT
                c.id_chat,
                c.tipo,
                c.fecha_creacion,
                c.id_grupo,
                g.nombre as nombre_grupo,
                u.id_usuario,
                u.nombre,
                u.nombreUsuario,
                u.foto,
                u.estado_conexion,
                (SELECT contenido FROM mensajes 
                WHERE id_chat = c.id_chat 
                ORDER BY fecha_envio DESC LIMIT 1) as ultimo_mensaje,
                (SELECT fecha_envio FROM mensajes 
                WHERE id_chat = c.id_chat 
                ORDER BY fecha_envio DESC LIMIT 1) as ultima_fecha,
                (SELECT COUNT(*) FROM participantes_chat WHERE id_chat = c.id_chat) as cantidad_miembros,
                (SELECT u2.nombreUsuario FROM mensajes m2 
                INNER JOIN usuarios u2 ON m2.id_remitente = u2.id_usuario 
                WHERE m2.id_chat = c.id_chat 
                ORDER BY m2.fecha_envio DESC LIMIT 1) as ultimo_remitente_usuario
            FROM chats c
            INNER JOIN participantes_chat pc ON c.id_chat = pc.id_chat
            LEFT JOIN usuarios u ON (
                c.tipo = 'privado' AND u.id_usuario != ? AND u.id_usuario IN (
                    SELECT id_usuario FROM participantes_chat 
                    WHERE id_chat = c.id_chat AND id_usuario != ?
                )
            )
            LEFT JOIN grupos g ON c.id_grupo = g.id_grupo
            WHERE pc.id_usuario = ?
            ORDER BY COALESCE(ultima_fecha, '1970-01-01') DESC, c.fecha_creacion DESC
        `, [userId, userId, userId]);

        const chatsFormateados = chats.map(chat => {
            let ultimoMensaje = chat.ultimo_mensaje;
            
            if (chat.tipo === 'grupal' && chat.ultimo_remitente_usuario && chat.ultimo_mensaje) {
                ultimoMensaje = `${chat.ultimo_remitente_usuario}: ${chat.ultimo_mensaje}`;
            }
            
            return {
                ...chat,
                ultimo_mensaje: ultimoMensaje
            };
        });

        res.json({
            success: true,
            chats: chatsFormateados
        });

    } catch (error) {
        console.error('Error obteniendo chats:', error);
        res.status(500).json({ 
            success: false,
            error: 'Error interno del servidor' 
        });
    }
});

// OBTENER MENSAJES DE UN CHAT
router.get('/:chatId/mensajes', authenticateToken, async (req, res) => {
    try {
        const { chatId } = req.params;
        const userId = req.user.id;
        
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
        
        const [chatInfo] = await promisePool.query(
            'SELECT tipo FROM chats WHERE id_chat = ?',
            [chatId]
        );
        
        const esGrupal = chatInfo[0]?.tipo === 'grupal';
        
        const [mensajes] = await promisePool.query(`
            SELECT 
                m.id_mensaje,
                m.id_remitente,
                m.contenido,
                m.tipo,
                m.url_multimedia,
                m.fecha_envio,
                m.recibido,
                m.leido,
                u.nombre as remitente_nombre,
                u.nombreUsuario as remitente_nombreUsuario,
                u.foto as remitente_foto
            FROM mensajes m
            INNER JOIN usuarios u ON m.id_remitente = u.id_usuario
            WHERE m.id_chat = ?
            ORDER BY m.fecha_envio ASC
        `, [chatId]);
        
        const mensajesFormateados = mensajes.map(msg => ({
            id: msg.id_mensaje,
            contenido: msg.contenido,
            timestamp: new Date(msg.fecha_envio).getTime(),
            enviado: msg.id_remitente === userId,
            tipo: msg.tipo,
            url: msg.url_multimedia,
            remitente: {
                id: msg.id_remitente,
                nombre: msg.remitente_nombre,
                nombreUsuario: msg.remitente_nombreUsuario,
                foto: msg.remitente_foto
            },
            nombre_remitente: esGrupal && msg.id_remitente !== userId ? 
                (msg.remitente_nombreUsuario || msg.remitente_nombre) : null
        }));
        
        res.json({
            success: true,
            mensajes: mensajesFormateados,
            esGrupal: esGrupal
        });
        
    } catch (error) {
        console.error('Error obteniendo mensajes:', error);
        res.status(500).json({ 
            success: false,
            error: 'Error interno del servidor' 
        });
    }
});

// 🔥 ENVIAR MENSAJE - ACTUALIZADO CON WEBSOCKET
router.post('/:chatId/mensajes', authenticateToken, async (req, res) => {
    try {
        const { chatId } = req.params;
        const { contenido, tipo = 'texto', url_multimedia = null } = req.body;
        const userId = req.user.id;
        
        if (!contenido && !url_multimedia) {
            return res.status(400).json({ 
                success: false,
                error: 'El mensaje no puede estar vacío' 
            });
        }
        
        // Verificar acceso al chat
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
        
        // 🔥 OBTENER TIPO DE CHAT
        const [chatInfo] = await promisePool.query(
            'SELECT tipo FROM chats WHERE id_chat = ?',
            [chatId]
        );
        
        const tipoChat = chatInfo[0]?.tipo;
        
        // Insertar mensaje
        const [result] = await promisePool.query(`
            INSERT INTO mensajes (id_chat, id_remitente, contenido, tipo, url_multimedia)
            VALUES (?, ?, ?, ?, ?)
        `, [chatId, userId, contenido, tipo, url_multimedia]);
        
        // Obtener el mensaje recién creado
        const [mensajeCreado] = await promisePool.query(`
            SELECT 
                m.id_mensaje,
                m.id_remitente,
                m.contenido,
                m.tipo,
                m.url_multimedia,
                m.fecha_envio,
                u.nombre as remitente_nombre,
                u.nombreUsuario as remitente_nombreUsuario,
                u.foto as remitente_foto
            FROM mensajes m
            INNER JOIN usuarios u ON m.id_remitente = u.id_usuario
            WHERE m.id_mensaje = ?
        `, [result.insertId]);
        
        const mensaje = mensajeCreado[0];
        
        const mensajeFormateado = {
            id: mensaje.id_mensaje,
            contenido: mensaje.contenido,
            timestamp: new Date(mensaje.fecha_envio).getTime(),
            enviado: true,
            tipo: mensaje.tipo,
            url: mensaje.url_multimedia,
            remitente: {
                id: mensaje.id_remitente,
                nombre: mensaje.remitente_nombre,
                nombreUsuario: mensaje.remitente_nombreUsuario,
                foto: mensaje.remitente_foto
            }
        };
        
        // 🔥 EMITIR MENSAJE POR WEBSOCKET
        if (io) {
            // Obtener todos los participantes del chat
            const [participantes] = await promisePool.query(
                'SELECT id_usuario FROM participantes_chat WHERE id_chat = ? AND id_usuario != ?',
                [chatId, userId]
            );
            
            // Emitir a cada participante
            participantes.forEach(participante => {
                const socketData = {
                    chatId: chatId,
                    messageId: mensaje.id_mensaje,
                    message: mensaje.contenido,
                    timestamp: new Date(mensaje.fecha_envio).getTime(),
                    fromUserId: userId,
                    nombreRemitente: mensaje.remitente_nombreUsuario || mensaje.remitente_nombre
                };
                
                // Emitir según tipo de chat
                if (tipoChat === 'grupal') {
                    io.to(`user-${participante.id_usuario}`).emit('receive-group-message', socketData);
                } else {
                    io.to(`user-${participante.id_usuario}`).emit('receive-private-message', socketData);
                }
            });
            
            console.log(`✅ Mensaje emitido a ${participantes.length} participantes del chat ${chatId}`);
        }
        
        res.json({
            success: true,
            mensaje: mensajeFormateado
        });
        
    } catch (error) {
        console.error('Error enviando mensaje:', error);
        res.status(500).json({ 
            success: false,
            error: 'Error interno del servidor' 
        });
    }
});

// CREAR CHAT PRIVADO
router.post('/privado/:userId', authenticateToken, async (req, res) => {
    try {
        const { userId: otroUsuarioId } = req.params;
        const usuarioId = req.user.id;
        
        if (usuarioId == otroUsuarioId) {
            return res.status(400).json({ 
                success: false,
                error: 'No puedes crear un chat contigo mismo' 
            });
        }
        
        // Verificar si ya existe un chat
        const [chatExistente] = await promisePool.query(`
            SELECT c.id_chat 
            FROM chats c
            INNER JOIN participantes_chat pc1 ON c.id_chat = pc1.id_chat
            INNER JOIN participantes_chat pc2 ON c.id_chat = pc2.id_chat
            WHERE c.tipo = 'privado' 
            AND pc1.id_usuario = ? 
            AND pc2.id_usuario = ?
        `, [usuarioId, otroUsuarioId]);
        
        if (chatExistente.length > 0) {
            return res.json({
                success: true,
                chatId: chatExistente[0].id_chat,
                mensaje: 'Chat ya existente'
            });
        }
        
        // Crear nuevo chat
        const [chatResult] = await promisePool.query(`
            INSERT INTO chats (tipo, id_creador) 
            VALUES ('privado', ?)
        `, [usuarioId]);
        
        const chatId = chatResult.insertId;
        
        // Agregar participantes
        await promisePool.query(`
            INSERT INTO participantes_chat (id_chat, id_usuario) 
            VALUES (?, ?), (?, ?)
        `, [chatId, usuarioId, chatId, otroUsuarioId]);
        
        res.json({
            success: true,
            chatId: chatId,
            mensaje: 'Chat creado exitosamente'
        });
        
    } catch (error) {
        console.error('Error creando chat:', error);
        res.status(500).json({ 
            success: false,
            error: 'Error interno del servidor' 
        });
    }
});

// CREAR CHAT GRUPAL
router.post('/grupo', authenticateToken, async (req, res) => {
    try {
        const { nombre, miembros } = req.body;
        const usuarioId = req.user.id;
        
        if (!nombre || !miembros || !Array.isArray(miembros) || miembros.length < 2) {
            return res.status(400).json({ 
                success: false,
                error: 'Nombre y al menos 2 miembros son requeridos' 
            });
        }
        
        // Verificar usuarios válidos
        const placeholders = miembros.map(() => '?').join(',');
        const [usuariosValidos] = await promisePool.query(
            `SELECT id_usuario FROM usuarios WHERE id_usuario IN (${placeholders})`,
            miembros
        );
        
        if (usuariosValidos.length !== miembros.length) {
            return res.status(400).json({ 
                success: false,
                error: 'Uno o más usuarios no existen' 
            });
        }
        
        // Crear grupo
        const [grupoResult] = await promisePool.query(`
            INSERT INTO grupos (nombre, id_creador) 
            VALUES (?, ?)
        `, [nombre, usuarioId]);
        
        const grupoId = grupoResult.insertId;
        
        // Crear chat grupal
        const [chatResult] = await promisePool.query(`
            INSERT INTO chats (tipo, id_creador, id_grupo) 
            VALUES ('grupal', ?, ?)
        `, [usuarioId, grupoId]);
        
        const chatId = chatResult.insertId;
        
        // Agregar participantes
        const todosLosMiembros = [usuarioId, ...miembros];
        const valoresParticipantes = todosLosMiembros.map(miembroId => [chatId, miembroId]);
        
        await promisePool.query(`
            INSERT INTO participantes_chat (id_chat, id_usuario) 
            VALUES ?
        `, [valoresParticipantes]);
        
        // Agregar a miembros_grupo
        const valoresMiembrosGrupo = todosLosMiembros.map(miembroId => [
            miembroId, 
            grupoId, 
            miembroId === usuarioId ? 'admin' : 'miembro'
        ]);
        
        await promisePool.query(`
            INSERT INTO miembros_grupo (id_usuario, id_grupo, rol) 
            VALUES ?
        `, [valoresMiembrosGrupo]);
        
        res.json({
            success: true,
            chatId: chatId,
            grupoId: grupoId,
            mensaje: 'Grupo creado exitosamente'
        });
        
    } catch (error) {
        console.error('Error creando grupo:', error);
        res.status(500).json({ 
            success: false,
            error: 'Error interno del servidor' 
        });
    }
});

// OBTENER INTEGRANTES DE GRUPO
router.get('/:chatId/integrantes', authenticateToken, async (req, res) => {
    try {
        const { chatId } = req.params;
        const userId = req.user.id;
        
        const [chatInfo] = await promisePool.query(`
            SELECT c.id_chat, c.tipo, c.id_grupo, g.nombre as nombre_grupo
            FROM chats c
            LEFT JOIN grupos g ON c.id_grupo = g.id_grupo
            WHERE c.id_chat = ?
        `, [chatId]);
        
        if (chatInfo.length === 0) {
            return res.status(404).json({ 
                success: false,
                error: 'Chat no encontrado' 
            });
        }
        
        const chat = chatInfo[0];
        
        if (chat.tipo !== 'grupal') {
            return res.status(400).json({ 
                success: false,
                error: 'Este chat no es un grupo' 
            });
        }
        
        if (!chat.id_grupo) {
            return res.status(500).json({ 
                success: false,
                error: 'Error: Chat grupal sin grupo asociado' 
            });
        }
        
        const [acceso] = await promisePool.query(
            'SELECT id_miembro FROM miembros_grupo WHERE id_grupo = ? AND id_usuario = ?',
            [chat.id_grupo, userId]
        );
        
        if (acceso.length === 0) {
            return res.status(403).json({ 
                success: false,
                error: 'No tienes acceso a este grupo' 
            });
        }
        
        const [integrantes] = await promisePool.query(`
            SELECT 
                mg.id_miembro,
                mg.id_usuario,
                mg.rol,
                mg.fecha_union,
                u.nombre,
                u.nombreUsuario,
                u.foto,
                u.estado_conexion as online
            FROM miembros_grupo mg
            INNER JOIN usuarios u ON mg.id_usuario = u.id_usuario
            WHERE mg.id_grupo = ?
            ORDER BY 
                CASE WHEN mg.rol = 'admin' THEN 1 ELSE 2 END,
                mg.fecha_union ASC
        `, [chat.id_grupo]);
        
        res.json({
            success: true,
            integrantes: integrantes,
            info_grupo: {
                id_grupo: chat.id_grupo,
                nombre_grupo: chat.nombre_grupo,
                total_miembros: integrantes.length
            }
        });
        
    } catch (error) {
        console.error('Error obteniendo integrantes:', error);
        res.status(500).json({ 
            success: false,
            error: 'Error interno del servidor' 
        });
    }
});

// 🔥 Exportar función para configurar Socket.IO
module.exports = router;
module.exports.setSocketIO = setSocketIO;