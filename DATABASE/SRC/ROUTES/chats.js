const express = require('express');
const router = express.Router();
const { promisePool } = require('../CONFIG/database');
const authenticateToken = require('../MIDDLEWARE/auth');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
let io;

router.setSocketIO = (socketIO) => {
    io = socketIO;
    console.log('✅ Socket.IO configurado en chats.js');
};
// OBTENER CHATS DEL USUARIO
// router.get('/', authenticateToken, async (req, res) => {
//     try {
//         const userId = req.user.id;
        
//         // Obtener chats donde el usuario es participante
//         const [chats] = await promisePool.query(`
//             SELECT DISTINCT
//                 c.id_chat,
//                 c.tipo,
//                 c.fecha_creacion,
//                 c.nombre as nombre_grupo,
//                 u.id_usuario,
//                 u.nombre,
//                 u.foto,
//                 u.estado_conexion,
//                 (SELECT contenido FROM mensajes 
//                  WHERE id_chat = c.id_chat 
//                  ORDER BY fecha_envio DESC LIMIT 1) as ultimo_mensaje,
//                 (SELECT fecha_envio FROM mensajes 
//                  WHERE id_chat = c.id_chat 
//                  ORDER BY fecha_envio DESC LIMIT 1) as ultima_fecha,
//                 (SELECT COUNT(*) FROM participantes_chat WHERE id_chat = c.id_chat) as cantidad_miembros
//             FROM chats c
//             INNER JOIN participantes_chat pc ON c.id_chat = pc.id_chat
//             LEFT JOIN usuarios u ON (
//                 c.tipo = 'privado' AND u.id_usuario != ? AND u.id_usuario IN (
//                     SELECT id_usuario FROM participantes_chat 
//                     WHERE id_chat = c.id_chat AND id_usuario != ?
//                 )
//             )
//             WHERE pc.id_usuario = ?
//             ORDER BY ultima_fecha DESC NULLS LAST, c.fecha_creacion DESC
//         `, [userId, userId, userId]);

//         res.json({
//             success: true,
//             chats: chats
//         });

//     } catch (error) {
//         console.error('Error obteniendo chats:', error);
//         res.status(500).json({ 
//             success: false,
//             error: 'Error interno del servidor' 
//         });
//     }
// });
const uploadDir = path.join(__dirname, '../../uploads/chats');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('✅ Directorio de uploads creado:', uploadDir);
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        console.log('📁 Guardando archivo en:', uploadDir);
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const nameWithoutExt = path.basename(file.originalname, ext);
        const filename = `${nameWithoutExt}-${uniqueSuffix}${ext}`;
        console.log('📝 Nombre de archivo generado:', filename);
        cb(null, filename);
    }
});

const fileFilter = (req, file, cb) => {
    console.log('🔍 Verificando tipo de archivo:', file.mimetype);
    
    const allowedTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'application/zip',
        'application/x-rar-compressed',
        'application/x-zip-compressed'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
        console.log('✅ Tipo de archivo permitido');
        cb(null, true);
    } else {
        console.error('❌ Tipo de archivo no permitido:', file.mimetype);
        cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB máximo
    }
});



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
                u.nombreUsuario,  -- ✅ NUEVO
                u.foto,
                u.estado_conexion,
                (SELECT contenido FROM mensajes 
                WHERE id_chat = c.id_chat 
                ORDER BY fecha_envio DESC LIMIT 1) as ultimo_mensaje,
                (SELECT fecha_envio FROM mensajes 
                WHERE id_chat = c.id_chat 
                ORDER BY fecha_envio DESC LIMIT 1) as ultima_fecha,
                (SELECT COUNT(*) FROM participantes_chat WHERE id_chat = c.id_chat) as cantidad_miembros,
                -- ✅ NUEVO: Información del último remitente con nombre de usuario
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

        // Formatear respuesta para usar nombre de usuario
        const chatsFormateados = chats.map(chat => {
            let ultimoMensaje = chat.ultimo_mensaje;
            
            // Para grupos, agregar quién envió el último mensaje CON NOMBRE DE USUARIO
            if (chat.tipo === 'grupal' && chat.ultimo_remitente_usuario && chat.ultimo_mensaje) {
                // Aquí necesitaríamos saber si el último mensaje fue enviado por el usuario actual
                // Por simplicidad, mostramos el nombre de usuario
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
// // OBTENER CHATS DEL USUARIO - VERSIÓN MEJORADA
// router.get('/', authenticateToken, async (req, res) => {
//     try {
//         const userId = req.user.id;
        
//         const [chats] = await promisePool.query(`
//             SELECT DISTINCT
//                 c.id_chat,
//                 c.tipo,
//                 c.fecha_creacion,
//                 c.id_grupo,
//                 g.nombre as nombre_grupo,
//                 u.id_usuario,
//                 u.nombre,
//                 u.foto,
//                 u.estado_conexion,
//                 (SELECT contenido FROM mensajes 
//                  WHERE id_chat = c.id_chat 
//                  ORDER BY fecha_envio DESC LIMIT 1) as ultimo_mensaje,
//                 (SELECT fecha_envio FROM mensajes 
//                  WHERE id_chat = c.id_chat 
//                  ORDER BY fecha_envio DESC LIMIT 1) as ultima_fecha,
//                 (SELECT COUNT(*) FROM participantes_chat WHERE id_chat = c.id_chat) as cantidad_miembros,
//                 -- ✅ NUEVO: Información del último remitente para grupos
//                 (SELECT u2.nombre FROM mensajes m2 
//                  INNER JOIN usuarios u2 ON m2.id_remitente = u2.id_usuario 
//                  WHERE m2.id_chat = c.id_chat 
//                  ORDER BY m2.fecha_envio DESC LIMIT 1) as ultimo_remitente
//             FROM chats c
//             INNER JOIN participantes_chat pc ON c.id_chat = pc.id_chat
//             LEFT JOIN usuarios u ON (
//                 c.tipo = 'privado' AND u.id_usuario != ? AND u.id_usuario IN (
//                     SELECT id_usuario FROM participantes_chat 
//                     WHERE id_chat = c.id_chat AND id_usuario != ?
//                 )
//             )
//             LEFT JOIN grupos g ON c.id_grupo = g.id_grupo
//             WHERE pc.id_usuario = ?
//             ORDER BY COALESCE(ultima_fecha, '1970-01-01') DESC, c.fecha_creacion DESC
//         `, [userId, userId, userId]);

//         // Formatear respuesta para incluir información del último remitente
//         const chatsFormateados = chats.map(chat => {
//             let ultimoMensaje = chat.ultimo_mensaje;
            
//             // Para grupos, agregar quién envió el último mensaje
//             if (chat.tipo === 'grupal' && chat.ultimo_remitente && chat.ultimo_mensaje) {
//                 const esMio = chat.ultimo_remitente === req.user.nombre;
//                 ultimoMensaje = esMio ? 
//                     `Tú: ${chat.ultimo_mensaje}` : 
//                     `${chat.ultimo_remitente}: ${chat.ultimo_mensaje}`;
//             }
            
//             return {
//                 ...chat,
//                 ultimo_mensaje: ultimoMensaje
//             };
//         });

//         res.json({
//             success: true,
//             chats: chatsFormateados
//         });

//     } catch (error) {
//         console.error('Error obteniendo chats:', error);
//         res.status(500).json({ 
//             success: false,
//             error: 'Error interno del servidor' 
//         });
//     }
// });

// OBTENER MENSAJES DE UN CHAT
router.get('/:chatId/mensajes', authenticateToken, async (req, res) => {
    try {
        const { chatId } = req.params;
        const userId = req.user.id;
        
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
        
        // Obtener tipo de chat
        const [chatInfo] = await promisePool.query(
            'SELECT tipo FROM chats WHERE id_chat = ?',
            [chatId]
        );
        
        const esGrupal = chatInfo[0]?.tipo === 'grupal';
        
        // Obtener mensajes CON flag de encriptación
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
                m.encrypted,
                u.nombre as remitente_nombre,
                u.nombreUsuario as remitente_nombreUsuario,
                u.foto as remitente_foto
            FROM mensajes m
            INNER JOIN usuarios u ON m.id_remitente = u.id_usuario
            WHERE m.id_chat = ?
            ORDER BY m.fecha_envio ASC
        `, [chatId]);
        
        // Formatear respuesta
        const mensajesFormateados = mensajes.map(msg => ({
            id: msg.id_mensaje,
            contenido: msg.contenido,
            timestamp: new Date(msg.fecha_envio).getTime(),
            enviado: msg.id_remitente === userId,
            tipo: msg.tipo,
            url: msg.url_multimedia,
            encrypted: msg.encrypted === 1, // 🔐 Incluir flag
            remitente: {
                id: msg.id_remitente,
                nombre: msg.remitente_nombre,
                nombreUsuario: msg.remitente_nombreUsuario,
                foto: msg.remitente_foto
            },
            nombre_remitente: esGrupal && msg.id_remitente !== userId ? 
                (msg.remitente_nombreUsuario || msg.remitente_nombre) : null
        }));
        
        console.log(`📨 ${mensajesFormateados.length} mensajes cargados (${mensajesFormateados.filter(m => m.encrypted).length} encriptados)`);
        
        res.json({
            success: true,
            mensajes: mensajesFormateados,
            esGrupal: esGrupal
        });
        
    } catch (error) {
        console.error('❌ Error obteniendo mensajes:', error);
        res.status(500).json({ 
            success: false,
            error: 'Error interno del servidor' 
        });
    }
});


router.post('/:chatId/upload', authenticateToken, (req, res, next) => {
    console.log('📥 Recibiendo petición de upload para chat:', req.params.chatId);
    console.log('👤 Usuario:', req.user.id);
    
    // Middleware de multer con manejo de errores
    upload.single('file')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            console.error('❌ Error de Multer:', err);
            
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({
                    success: false,
                    error: 'El archivo es demasiado grande. Máximo 10MB'
                });
            }
            
            return res.status(400).json({
                success: false,
                error: `Error de Multer: ${err.message}`
            });
        } else if (err) {
            console.error('❌ Error general:', err);
            return res.status(400).json({
                success: false,
                error: err.message
            });
        }
        
        // Si no hay errores, continuar con el handler
        handleFileUpload(req, res);
    });
});

// Handler separado para procesar el archivo subido
async function handleFileUpload(req, res) {
    try {
        const { chatId } = req.params;
        const userId = req.user.id;
        
        console.log('🔄 Procesando archivo subido');
        
        if (!req.file) {
            console.error('❌ No se recibió archivo');
            return res.status(400).json({
                success: false,
                error: 'No se proporcionó ningún archivo'
            });
        }
        
        console.log('📄 Archivo recibido:', {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            filename: req.file.filename,
            path: req.file.path
        });
        
        // Verificar acceso al chat
        const [acceso] = await promisePool.query(
            'SELECT id_participante FROM participantes_chat WHERE id_chat = ? AND id_usuario = ?',
            [chatId, userId]
        );
        
        if (acceso.length === 0) {
            console.error('❌ Usuario sin acceso al chat');
            fs.unlinkSync(req.file.path);
            return res.status(403).json({
                success: false,
                error: 'No tienes acceso a este chat'
            });
        }
        
        // Determinar tipo de mensaje según el archivo
        const tipoMensaje = req.file.mimetype.startsWith('image/') ? 'imagen' : 'archivo';
        const urlArchivo = `/uploads/chats/${req.file.filename}`;
        
        console.log('💾 Guardando en BD:', { tipoMensaje, urlArchivo });
        
        // Guardar mensaje en BD
        const [result] = await promisePool.query(`
            INSERT INTO mensajes (id_chat, id_remitente, contenido, tipo, url_multimedia)
            VALUES (?, ?, ?, ?, ?)
        `, [chatId, userId, req.file.originalname, tipoMensaje, urlArchivo]);
        
        console.log('✅ Mensaje guardado con ID:', result.insertId);
        
        // Obtener mensaje completo
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
        
        // Obtener tipo de chat
        const [chatInfo] = await promisePool.query(
            'SELECT tipo FROM chats WHERE id_chat = ?',
            [chatId]
        );
        
        const esGrupal = chatInfo[0]?.tipo === 'grupal';
        
        // Emitir por WebSocket
        if (io) {
            const mensajeSocket = {
                chatId: parseInt(chatId),
                fromUserId: userId,
                message: mensaje.contenido,
                timestamp: new Date(mensaje.fecha_envio).getTime(),
                messageId: mensaje.id_mensaje,
                tipo: mensaje.tipo,
                url: mensaje.url_multimedia,
                nombreRemitente: mensaje.remitente_nombreUsuario || mensaje.remitente_nombre
            };
            
            if (esGrupal) {
                io.to(`chat-${chatId}`).emit('receive-group-message', mensajeSocket);
                console.log(`💬 Mensaje grupal emitido al chat-${chatId}`);
            } else {
                const [participantes] = await promisePool.query(
                    'SELECT id_usuario FROM participantes_chat WHERE id_chat = ? AND id_usuario != ?',
                    [chatId, userId]
                );
                
                if (participantes.length > 0) {
                    io.to(`user-${participantes[0].id_usuario}`).emit('receive-private-message', mensajeSocket);
                    console.log(`💬 Mensaje privado emitido a user-${participantes[0].id_usuario}`);
                }
            }
        }
        
        console.log('✅ Archivo subido exitosamente');
        
        res.json({
            success: true,
            mensaje: {
                id: mensaje.id_mensaje,
                contenido: mensaje.contenido,
                timestamp: new Date(mensaje.fecha_envio).getTime(),
                enviado: true,
                tipo: mensaje.tipo,
                url: mensaje.url_multimedia,
                nombreArchivo: req.file.originalname,
                tamañoArchivo: req.file.size,
                remitente: {
                    id: mensaje.id_remitente,
                    nombre: mensaje.remitente_nombre,
                    nombreUsuario: mensaje.remitente_nombreUsuario,
                    foto: mensaje.remitente_foto
                }
            }
        });
        
    } catch (error) {
        console.error('❌ Error subiendo archivo:', error);
        
        // Eliminar archivo en caso de error
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
                console.log('🗑️ Archivo eliminado por error');
            } catch (unlinkError) {
                console.error('Error eliminando archivo:', unlinkError);
            }
        }
        
        res.status(500).json({
            success: false,
            error: 'Error al subir archivo',
            details: error.message
        });
    }
}

// 🔐 ACTUALIZAR ESTADO DE ENCRIPTACIÓN DE UN CHAT
router.put('/:chatId/encryption', authenticateToken, async (req, res) => {
    try {
        const { chatId } = req.params;
        const { encrypted } = req.body;
        const userId = req.user.id;

        console.log(`🔐 Actualizando encriptación para chat ${chatId}: ${encrypted}`);

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

        // Actualizar estado de encriptación
        await promisePool.query(
            'UPDATE chats SET encrypted = ? WHERE id_chat = ?',
            [encrypted ? 1 : 0, chatId]
        );

        console.log(`✅ Encriptación ${encrypted ? 'activada' : 'desactivada'} para chat ${chatId}`);

        res.json({
            success: true,
            encrypted: encrypted,
            message: `Encriptación ${encrypted ? 'activada' : 'desactivada'} correctamente`
        });

    } catch (error) {
        console.error('❌ Error actualizando encriptación:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

// 🔐 OBTENER ESTADO DE ENCRIPTACIÓN DE UN CHAT
router.get('/:chatId/encryption', authenticateToken, async (req, res) => {
    try {
        const { chatId } = req.params;
        const userId = req.user.id;

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

        // Obtener estado de encriptación
        const [chatInfo] = await promisePool.query(
            'SELECT encrypted FROM chats WHERE id_chat = ?',
            [chatId]
        );

        if (chatInfo.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Chat no encontrado'
            });
        }

        res.json({
            success: true,
            encrypted: chatInfo[0].encrypted === 1
        });

    } catch (error) {
        console.error('❌ Error obteniendo estado de encriptación:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});


async function handleFileUpload(req, res) {
    try {
        const { chatId } = req.params;
        const userId = req.user.id;
        
        console.log('🔄 Procesando archivo subido');
        
        if (!req.file) {
            console.error('❌ No se recibió archivo');
            return res.status(400).json({
                success: false,
                error: 'No se proporcionó ningún archivo'
            });
        }
        
        console.log('📄 Archivo recibido:', {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            filename: req.file.filename,
            path: req.file.path
        });
        
        // Verificar acceso al chat
        const [acceso] = await promisePool.query(
            'SELECT id_participante FROM participantes_chat WHERE id_chat = ? AND id_usuario = ?',
            [chatId, userId]
        );
        
        if (acceso.length === 0) {
            console.error('❌ Usuario sin acceso al chat');
            // Eliminar archivo si no tiene acceso
            fs.unlinkSync(req.file.path);
            return res.status(403).json({
                success: false,
                error: 'No tienes acceso a este chat'
            });
        }
        
        // Determinar tipo de mensaje según el archivo
        const tipoMensaje = req.file.mimetype.startsWith('image/') ? 'imagen' : 'archivo';
        const urlArchivo = `/uploads/chats/${req.file.filename}`;
        
        console.log('💾 Guardando en BD:', { tipoMensaje, urlArchivo });
        
        // Guardar mensaje en BD
        const [result] = await promisePool.query(`
            INSERT INTO mensajes (id_chat, id_remitente, contenido, tipo, url_multimedia)
            VALUES (?, ?, ?, ?, ?)
        `, [chatId, userId, req.file.originalname, tipoMensaje, urlArchivo]);
        
        console.log('✅ Mensaje guardado con ID:', result.insertId);
        
        // Obtener mensaje completo
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
        
        // Obtener tipo de chat
        const [chatInfo] = await promisePool.query(
            'SELECT tipo FROM chats WHERE id_chat = ?',
            [chatId]
        );
        
        const esGrupal = chatInfo[0]?.tipo === 'grupal';
        
        // Emitir por WebSocket
        if (io) {
            const mensajeSocket = {
                chatId: parseInt(chatId),
                fromUserId: userId,
                message: mensaje.contenido,
                timestamp: new Date(mensaje.fecha_envio).getTime(),
                messageId: mensaje.id_mensaje,
                tipo: mensaje.tipo,
                url: mensaje.url_multimedia,
                nombreRemitente: mensaje.remitente_nombreUsuario || mensaje.remitente_nombre
            };
            
            if (esGrupal) {
                io.to(`chat-${chatId}`).emit('receive-group-message', mensajeSocket);
                console.log(`💬 Mensaje grupal emitido al chat-${chatId}`);
            } else {
                const [participantes] = await promisePool.query(
                    'SELECT id_usuario FROM participantes_chat WHERE id_chat = ? AND id_usuario != ?',
                    [chatId, userId]
                );
                
                if (participantes.length > 0) {
                    io.to(`user-${participantes[0].id_usuario}`).emit('receive-private-message', mensajeSocket);
                    console.log(`💬 Mensaje privado emitido a user-${participantes[0].id_usuario}`);
                }
            }
        }
        
        console.log('✅ Archivo subido exitosamente');
        
        res.json({
            success: true,
            mensaje: {
                id: mensaje.id_mensaje,
                contenido: mensaje.contenido,
                timestamp: new Date(mensaje.fecha_envio).getTime(),
                enviado: true,
                tipo: mensaje.tipo,
                url: mensaje.url_multimedia,
                nombreArchivo: req.file.originalname,
                tamañoArchivo: req.file.size,
                remitente: {
                    id: mensaje.id_remitente,
                    nombre: mensaje.remitente_nombre,
                    nombreUsuario: mensaje.remitente_nombreUsuario,
                    foto: mensaje.remitente_foto
                }
            }
        });
        
    } catch (error) {
        console.error('❌ Error subiendo archivo:', error);
        
        // Eliminar archivo en caso de error
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
                console.log('🗑️ Archivo eliminado por error');
            } catch (unlinkError) {
                console.error('Error eliminando archivo:', unlinkError);
            }
        }
        
        res.status(500).json({
            success: false,
            error: 'Error al subir archivo',
            details: error.message
        });
    }
}

// 🔥 NUEVA RUTA: SUBIR ARCHIVO/IMAGEN

// ENVIAR MENSAJE
// router.post('/:chatId/mensajes', authenticateToken, async (req, res) => {
//     try {
//         const { chatId } = req.params;
//         const { contenido, tipo = 'texto', url_multimedia = null } = req.body;
//         const userId = req.user.id;
        
//         if (!contenido && !url_multimedia) {
//             return res.status(400).json({ 
//                 success: false,
//                 error: 'El mensaje no puede estar vacío' 
//             });
//         }
        
//         // Verificar acceso al chat
//         const [acceso] = await promisePool.query(
//             'SELECT id_participante FROM participantes_chat WHERE id_chat = ? AND id_usuario = ?',
//             [chatId, userId]
//         );
        
//         if (acceso.length === 0) {
//             return res.status(403).json({ 
//                 success: false,
//                 error: 'No tienes acceso a este chat' 
//             });
//         }
        
//         // Insertar mensaje en BD
//         const [result] = await promisePool.query(`
//             INSERT INTO mensajes (id_chat, id_remitente, contenido, tipo, url_multimedia)
//             VALUES (?, ?, ?, ?, ?)
//         `, [chatId, userId, contenido, tipo, url_multimedia]);
        
//         // Obtener el mensaje recién creado CON datos del remitente
//         const [mensajeCreado] = await promisePool.query(`
//             SELECT 
//                 m.id_mensaje,
//                 m.id_remitente,
//                 m.contenido,
//                 m.tipo,
//                 m.url_multimedia,
//                 m.fecha_envio,
//                 u.nombre as remitente_nombre,
//                 u.nombreUsuario as remitente_nombreUsuario,
//                 u.foto as remitente_foto
//             FROM mensajes m
//             INNER JOIN usuarios u ON m.id_remitente = u.id_usuario
//             WHERE m.id_mensaje = ?
//         `, [result.insertId]);
        
//         const mensaje = mensajeCreado[0];
        
//         // 🔥 OBTENER TIPO DE CHAT (privado o grupal)
//         const [chatInfo] = await promisePool.query(
//             'SELECT tipo FROM chats WHERE id_chat = ?',
//             [chatId]
//         );
        
//         const esGrupal = chatInfo[0]?.tipo === 'grupal';
        
//         // 🔥 EMITIR MENSAJE POR WEBSOCKET
//         if (io) {
//             if (esGrupal) {
//                 io.to(`chat-${chatId}`).emit('receive-group-message', {
//                     chatId: parseInt(chatId),
//                     fromUserId: userId,
//                     message: contenido,
//                     timestamp: new Date(mensaje.fecha_envio).getTime(),
//                     messageId: mensaje.id_mensaje,
//                     nombreRemitente: mensaje.remitente_nombreUsuario || mensaje.remitente_nombre,
//                     tipo: tipo,
//                     url: url_multimedia
//                 });
                
//                 console.log(`💥 Mensaje grupal emitido al chat-${chatId}`);
//             } else {
//                 const [participantes] = await promisePool.query(
//                     'SELECT id_usuario FROM participantes_chat WHERE id_chat = ? AND id_usuario != ?',
//                     [chatId, userId]
//                 );
                
//                 if (participantes.length > 0) {
//                     const otroUsuarioId = participantes[0].id_usuario;
                    
//                     io.to(`user-${otroUsuarioId}`).emit('receive-private-message', {
//                         chatId: parseInt(chatId),
//                         fromUserId: userId,
//                         message: contenido,
//                         timestamp: new Date(mensaje.fecha_envio).getTime(),
//                         messageId: mensaje.id_mensaje,
//                         tipo: tipo,
//                         url: url_multimedia
//                     });
                    
//                     console.log(`📨 Mensaje privado emitido a user-${otroUsuarioId}`);
//                 }
//             }
//         } else {
//             console.warn('⚠️ Socket.IO no está disponible');
//         }
        
//         // Responder al cliente
//         res.json({
//             success: true,
//             mensaje: {
//                 id: mensaje.id_mensaje,
//                 contenido: mensaje.contenido,
//                 timestamp: new Date(mensaje.fecha_envio).getTime(),
//                 enviado: true,
//                 tipo: mensaje.tipo,
//                 url: mensaje.url_multimedia,
//                 remitente: {
//                     id: mensaje.id_remitente,
//                     nombre: mensaje.remitente_nombre,
//                     nombreUsuario: mensaje.remitente_nombreUsuario,
//                     foto: mensaje.remitente_foto
//                 }
//             }
//         });
        
//     } catch (error) {
//         console.error('❌ Error enviando mensaje:', error);
//         res.status(500).json({ 
//             success: false,
//             error: 'Error interno del servidor' 
//         });
//     }
// });

router.post('/:chatId/mensajes', authenticateToken, async (req, res) => {
    try {
        const { chatId } = req.params;
        const { contenido, tipo = 'texto', url_multimedia = null, encrypted = false } = req.body;
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
        
        // 🔐 Insertar mensaje CON flag de encriptación
        const [result] = await promisePool.query(`
            INSERT INTO mensajes (id_chat, id_remitente, contenido, tipo, url_multimedia, encrypted)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [chatId, userId, contenido, tipo, url_multimedia, encrypted ? 1 : 0]);
        
        console.log(`📨 Mensaje ${encrypted ? '🔐 encriptado' : ''} guardado con ID: ${result.insertId}`);
        
        // Obtener el mensaje recién creado CON datos del remitente
        const [mensajeCreado] = await promisePool.query(`
            SELECT 
                m.id_mensaje,
                m.id_remitente,
                m.contenido,
                m.tipo,
                m.url_multimedia,
                m.fecha_envio,
                m.encrypted,
                u.nombre as remitente_nombre,
                u.nombreUsuario as remitente_nombreUsuario,
                u.foto as remitente_foto
            FROM mensajes m
            INNER JOIN usuarios u ON m.id_remitente = u.id_usuario
            WHERE m.id_mensaje = ?
        `, [result.insertId]);
        
        const mensaje = mensajeCreado[0];
        
        // Obtener tipo de chat (privado o grupal)
        const [chatInfo] = await promisePool.query(
            'SELECT tipo FROM chats WHERE id_chat = ?',
            [chatId]
        );
        
        const esGrupal = chatInfo[0]?.tipo === 'grupal';
        
        // Emitir mensaje por WebSocket
        if (io) {
            const mensajeSocket = {
                chatId: parseInt(chatId),
                fromUserId: userId,
                message: contenido,
                timestamp: new Date(mensaje.fecha_envio).getTime(),
                messageId: mensaje.id_mensaje,
                nombreRemitente: mensaje.remitente_nombreUsuario || mensaje.remitente_nombre,
                tipo: tipo,
                url: url_multimedia,
                encrypted: encrypted // 🔐 Incluir flag de encriptación
            };
            
            if (esGrupal) {
                io.to(`chat-${chatId}`).emit('receive-group-message', mensajeSocket);
                console.log(`💬 Mensaje grupal ${encrypted ? '🔐 encriptado' : ''} emitido al chat-${chatId}`);
            } else {
                const [participantes] = await promisePool.query(
                    'SELECT id_usuario FROM participantes_chat WHERE id_chat = ? AND id_usuario != ?',
                    [chatId, userId]
                );
                
                if (participantes.length > 0) {
                    const otroUsuarioId = participantes[0].id_usuario;
                    io.to(`user-${otroUsuarioId}`).emit('receive-private-message', mensajeSocket);
                    console.log(`📨 Mensaje privado ${encrypted ? '🔐 encriptado' : ''} emitido a user-${otroUsuarioId}`);
                }
            }
        }
        
        // Responder al cliente
        res.json({
            success: true,
            mensaje: {
                id: mensaje.id_mensaje,
                contenido: mensaje.contenido,
                timestamp: new Date(mensaje.fecha_envio).getTime(),
                enviado: true,
                tipo: mensaje.tipo,
                url: mensaje.url_multimedia,
                encrypted: encrypted, // 🔐 Incluir flag
                remitente: {
                    id: mensaje.id_remitente,
                    nombre: mensaje.remitente_nombre,
                    nombreUsuario: mensaje.remitente_nombreUsuario,
                    foto: mensaje.remitente_foto
                }
            }
        });
        
    } catch (error) {
        console.error('❌ Error enviando mensaje:', error);
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
        
        // Verificar si ya existe un chat entre estos usuarios
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
// router.post('/grupo', authenticateToken, async (req, res) => {
//     try {
//         const { nombre, miembros } = req.body;
//         const usuarioId = req.user.id;
        
//         if (!nombre || !miembros || !Array.isArray(miembros) || miembros.length === 0) {
//             return res.status(400).json({ 
//                 success: false,
//                 error: 'Nombre y miembros son requeridos' 
//             });
//         }
        
//         // Verificar que todos los miembros existen
//         const placeholders = miembros.map(() => '?').join(',');
//         const [usuariosValidos] = await promisePool.query(
//             `SELECT id_usuario FROM usuarios WHERE id_usuario IN (${placeholders})`,
//             miembros
//         );
        
//         if (usuariosValidos.length !== miembros.length) {
//             return res.status(400).json({ 
//                 success: false,
//                 error: 'Uno o más usuarios no existen' 
//             });
//         }
        
//         // Crear chat grupal
//         const [chatResult] = await promisePool.query(`
//             INSERT INTO chats (tipo, id_creador, nombre) 
//             VALUES ('grupal', ?, ?)
//         `, [usuarioId, nombre]);
        
//         const chatId = chatResult.insertId;
        
//         // Agregar participantes (creador + miembros)
//         const valoresParticipantes = [
//             [chatId, usuarioId], // Creador
//             ...miembros.map(miembroId => [chatId, miembroId]) // Demás miembros
//         ];
        
//         await promisePool.query(`
//             INSERT INTO participantes_chat (id_chat, id_usuario) 
//             VALUES ?
//         `, [valoresParticipantes]);
        
//         res.json({
//             success: true,
//             chatId: chatId,
//             mensaje: 'Grupo creado exitosamente'
//         });
        
//     } catch (error) {
//         console.error('Error creando grupo:', error);
//         res.status(500).json({ 
//             success: false,
//             error: 'Error interno del servidor' 
//         });
//     }
// });
//CREACION CHAT GRUPAL
router.post('/grupo', authenticateToken, async (req, res) => {
    try {
        const { nombre, miembros } = req.body;
        const usuarioId = req.user.id;
        
        if (!nombre || !miembros || !Array.isArray(miembros) || miembros.length === 0) {
            return res.status(400).json({ 
                success: false,
                error: 'Nombre y miembros son requeridos' 
            });
        }
        
        if (miembros.length < 2) {
            return res.status(400).json({ 
                success: false,
                error: 'Debes seleccionar al menos 2 usuarios' 
            });
        }
        
        // Verificar que todos los miembros existen
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
        
        // Crear el grupo en la tabla grupos
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
        
        // Agregar participantes (creador + miembros)
        const todosLosMiembros = [usuarioId, ...miembros];
        const valoresParticipantes = todosLosMiembros.map(miembroId => [chatId, miembroId]);
        
        await promisePool.query(`
            INSERT INTO participantes_chat (id_chat, id_usuario) 
            VALUES ?
        `, [valoresParticipantes]);
        
        // También agregar a la tabla miembros_grupo
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

// // OBTENER INTEGRANTES DE GRUPO
// router.get('/:chatId/integrantes', authenticateToken, async (req, res) => {
//     try {
//         const { chatId } = req.params;
//         const userId = req.user.id;
        
//         // Verificar acceso al chat
//         const [acceso] = await promisePool.query(
//             'SELECT id_miembro FROM miembros_grupo WHERE id_grupo = ? AND id_usuario = ?',
//             [chatId, userId]
//         );
        
//         if (acceso.length === 0) {
//             return res.status(403).json({ 
//                 success: false,
//                 error: 'No tienes acceso a este chat' 
//             });
//         }
        
//         // Verificar que es un chat grupal
//         const [chatInfo] = await promisePool.query(
//             'SELECT tipo FROM chats WHERE id_chat = ?',
//             [chatId]
//         );
        
//         if (chatInfo.length === 0 || chatInfo[0].tipo !== 'grupal') {
//             return res.status(400).json({ 
//                 success: false,
//                 error: 'Este chat no es un grupo' 
//             });
//         }
        
//         // Obtener integrantes
//         const [integrantes] = await promisePool.query(`
//             SELECT 
//                 u.id_usuario,
//                 u.nombre,
//                 u.foto,
//                 u.estado_conexion as online
//             FROM miembros_grupo mg
//             INNER JOIN usuarios u ON mg.id_usuario = u.id_usuario
//             WHERE mg.id_grupo = ?
//             ORDER BY mg.fecha_union ASC
//         `, [chatId]);
        
//         res.json({
//             success: true,
//             integrantes: integrantes
//         });
        
//     } catch (error) {
//         console.error('Error obteniendo integrantes:', error);
//         res.status(500).json({ 
//             success: false,
//             error: 'Error interno del servidor' 
//         });
//     }
// });

// OBTENER INTEGRANTES DE GRUPO - VERSIÓN CORREGIDA
router.get('/:chatId/integrantes', authenticateToken, async (req, res) => {
    try {
        const { chatId } = req.params;
        const userId = req.user.id;
        
        console.log(`🔍 Solicitando integrantes para chat: ${chatId}, usuario: ${userId}`);
        
        // 1. Verificar que el chat existe y es grupal, y obtener el id_grupo
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
        
        console.log(`📋 Chat grupal encontrado. ID Grupo: ${chat.id_grupo}`);
        
        // 2. Verificar acceso al grupo (a través de miembros_grupo)
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
        
        console.log(`✅ Usuario autorizado. Cargando integrantes del grupo ${chat.id_grupo}...`);
        
        // 3. Obtener integrantes DESDE LA TABLA miembros_grupo
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
        
        console.log(`✅ ${integrantes.length} integrantes encontrados`);
        
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
        console.error('❌ Error obteniendo integrantes:', error);
        res.status(500).json({ 
            success: false,
            error: 'Error interno del servidor' 
        });
    }
});

// OBTENER INTEGRANTES DE GRUPO
// router.get('/:chatId/integrantes', authenticateToken, async (req, res) => {
//     try {
//         const { chatId } = req.params;
//         const userId = req.user.id;
        
//         // Verificar acceso al chat (usando tu estructura actual)
//         const [acceso] = await promisePool.query(
//             'SELECT id_participante FROM participantes_chat WHERE id_chat = ? AND id_usuario = ?',
//             [chatId, userId]
//         );
        
//         if (acceso.length === 0) {
//             return res.status(403).json({ 
//                 success: false,
//                 error: 'No tienes acceso a este chat' 
//             });
//         }
        
//         // Verificar que es un chat grupal
//         const [chatInfo] = await promisePool.query(
//             'SELECT tipo FROM chats WHERE id_chat = ?',
//             [chatId]
//         );
        
//         if (chatInfo.length === 0 || chatInfo[0].tipo !== 'grupal') {
//             return res.status(400).json({ 
//                 success: false,
//                 error: 'Este chat no es un grupo' 
//             });
//         }
        
//         //Obtener integrantes (adaptado a tu estructura actual)
//         const [integrantes] = await promisePool.query(`
//             SELECT 
//                 u.id_usuario as id,
//                 u.nombre,
//                 u.foto,
//                 u.estado_conexion as online
//             FROM participantes_chat pc
//             INNER JOIN usuarios u ON pc.id_usuario = u.id_usuario
//             WHERE pc.id_chat = ?
//             ORDER BY pc.id_participante ASC  -- Ordenar por id_participante en lugar de fecha_union
//         `, [chatId]);
        
//         res.json({
//             success: true,
//             integrantes: integrantes
//         });
        
//     } catch (error) {
//         console.error('Error obteniendo integrantes:', error);
//         res.status(500).json({ 
//             success: false,
//             error: 'Error interno del servidor' 
//         });
//     }
// });


module.exports = router;