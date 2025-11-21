const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const http = require('http');
const socketio = require('socket.io');
require('dotenv').config();

const { promisePool } = require('./CONFIG/database');
const userRoutes = require('./ROUTES/users');
const profileRoutes = require('./ROUTES/profile');
const contactosRoutes = require('./ROUTES/contactos');
const chatRoutes = require('./ROUTES/chats');
const videollamadasRoutes = require('./ROUTES/videollamadas');
const tareasRoutes = require('./ROUTES/tareas');
const simulacionRoutes = require('./ROUTES/simulacion');
const jugadoresRoutes = require('./ROUTES/jugadores');
const estadisticasRoutes = require('./ROUTES/estadisticas');
const logrosRoutes = require('./ROUTES/logros');

const app = express();
const PORT = process.env.PORT || 3001;

// ✅ CONFIGURACIÓN CORS
app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json());
app.use(express.urlencoded({extended: true}));

const authenticateToken = require('./MIDDLEWARE/auth');

// ✅ CREAR SERVIDOR HTTP
const server = http.createServer(app);
const io = socketio(server, {
    cors: {
        origin: true,
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling']
});

// ✅ MIDDLEWARE DE LOGS
app.use((req, res, next) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    next();
});

// 🔥 CONFIGURACIÓN DE WEBSOCKETS - CON WEBRTC SIGNALING
io.on('connection', (socket) => {
    console.log('✅ Usuario conectado:', socket.id);

    // Usuario se une a su sala personal
    socket.on('join-user', (userId) => {
        socket.join(`user-${userId}`);
        socket.userId = userId;
        console.log(`👤 Usuario ${userId} unido a sala user-${userId}`);
    });

    // ==================== MENSAJERÍA ====================
    socket.on('send-private-message', async (data) => {
        try {
            const { fromUserId, toUserId, message, timestamp } = data;
            console.log(`📨 Mensaje manual de ${fromUserId} para ${toUserId}`);
            
            io.to(`user-${toUserId}`).emit('receive-private-message', {
                fromUserId,
                message,
                timestamp,
                messageId: Date.now()
            });
            
            socket.emit('message-sent', {
                messageId: Date.now(),
                timestamp
            });
            
        } catch (error) {
            console.error('Error enviando mensaje:', error);
            socket.emit('message-error', {
                error: 'No se pudo enviar el mensaje'
            });
        }
    });

    socket.on('send-group-message', (data) => {
        const { chatId, fromUserId, message, timestamp } = data;
        console.log(`👥 Mensaje grupal manual en chat ${chatId}`);
        
        io.to(`chat-${chatId}`).emit('receive-group-message', {
            chatId,
            fromUserId,
            message,
            timestamp,
            messageId: Date.now()
        });
    });

    socket.on('join-group', (chatId) => {
        socket.join(`chat-${chatId}`);
        console.log(`👥 Usuario unido al chat: chat-${chatId}`);
    });

    // ==================== WEBRTC SIGNALING ====================
    
    socket.on('webrtc-offer', (data) => {
        const { callId, toUserId, offer } = data;
        console.log(`📞 WebRTC Offer de ${socket.userId} → ${toUserId}`);
        
        io.to(`user-${toUserId}`).emit('webrtc-offer', {
            callId,
            fromUserId: socket.userId,
            offer
        });
    });

    socket.on('webrtc-answer', (data) => {
        const { callId, toUserId, answer } = data;
        console.log(`✅ WebRTC Answer de ${socket.userId} → ${toUserId}`);
        
        io.to(`user-${toUserId}`).emit('webrtc-answer', {
            callId,
            fromUserId: socket.userId,
            answer
        });
    });

    socket.on('webrtc-ice-candidate', (data) => {
        const { callId, toUserId, candidate } = data;
        console.log(`🧊 ICE Candidate de ${socket.userId} → ${toUserId}`);
        
        io.to(`user-${toUserId}`).emit('webrtc-ice-candidate', {
            callId,
            fromUserId: socket.userId,
            candidate
        });
    });

    // 🔥 NUEVO: Evento de cambio de estado de cámara
    socket.on('camera-state-changed', (data) => {
        const { callId, toUserId, cameraEnabled } = data;
        console.log(`📹 Usuario ${socket.userId} ${cameraEnabled ? 'activó' : 'desactivó'} su cámara en llamada ${callId}`);
        
        io.to(`user-${toUserId}`).emit('camera-state-changed', {
            callId: callId,
            fromUserId: socket.userId,
            cameraEnabled: cameraEnabled
        });
    });

    socket.on('disconnect', () => {
        console.log('❌ Usuario desconectado:', socket.id);
        
        if (socket.currentCall) {
            io.to(`call-${socket.currentCall}`).emit('peer-disconnected', {
                userId: socket.userId
            });
        }
    });
});

// 🔥 PASAR io A LOS ROUTERS
chatRoutes.setSocketIO(io);
videollamadasRoutes.setSocketIO(io);
tareasRoutes.setSocketIO(io);

// Servir archivos estáticos
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use(express.static(path.join(__dirname,'../../')));

// Rutas API
app.use('/api/users', userRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/contactos', contactosRoutes);
app.use('/api/videollamadas', videollamadasRoutes);
app.use('/api/tareas', tareasRoutes);
app.use('/api/simulacion', simulacionRoutes);
app.use('/api/jugadores', jugadoresRoutes);
app.use('/api/estadisticas', estadisticasRoutes);
app.use('/api/logros', logrosRoutes);

// ✅ ENDPOINT DE PAÍSES
app.get('/api/paises', async (req, res) => {
    try {
        console.log('🌎 Solicitando países...');
        const query = 'SELECT id, nombre FROM pais ORDER BY nombre';
        const [paises] = await promisePool.query(query);
        console.log(`✅ Países obtenidos: ${paises.length}`);
        res.json(paises);
    } catch(error) {
        console.error('❌ Error países:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            message: error.message 
        });
    }
});

// ✅ ENDPOINTS DE PRUEBA
app.get('/api/test', (req, res) => {
    res.json({
        message: "✅ Servidor funcionando",
        timestamp: new Date().toISOString(),
        socketio: io ? 'Conectado' : 'No conectado'
    });
});

app.get('/api/test-db', async (req, res) => {
    try {
        const [result] = await promisePool.query('SELECT 1 + 1 as result');
        res.json({
            message: "✅ BD conectada",
            result: result[0].result
        });
    } catch (error) {
        res.status(500).json({
            message: "❌ Error BD",
            error: error.message
        });
    }
});

// Ruta raíz
app.get('/', (req, res) => {
    res.json({ 
        message: 'API de Fútbol Fantasía',
        status: '✅ Funcionando',
        websocket: 'Activo'
    });
});

// Rutas de páginas HTML
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../../HTML/login.html'));
});

app.get('/registro', (req, res) => {
    res.sendFile(path.join(__dirname, '../../HTML/registro.html'));
});

app.get('/perfil', (req, res) => {
    res.sendFile(path.join(__dirname, '../../HTML/perfil.html'));
});

app.get('/chats', (req, res) => {
    res.sendFile(path.join(__dirname, '../../HTML/chats.html'));
});

app.get('/llamada', (req, res) => {
    res.sendFile(path.join(__dirname, '../../HTML/llamada.html'));
});

app.get('/simulacion', (req, res) => {
    res.sendFile(path.join(__dirname, '../../HTML/simulacion.html'));
});

app.get('/torneos', (req, res) => {
    res.sendFile(path.join(__dirname, '../../HTML/torneos.html'));
});

// ✅ RUTA 404
app.use((req, res) => {
    res.status(404).json({
        error: 'Ruta no encontrada',
        path: req.originalUrl
    });
});

// ✅ INICIAR SERVIDOR
server.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    console.log(`🌐 Listo para Ngrok`);
    console.log(`📡 WebSocket activo en el mismo puerto`);
    console.log(`📞 Sistema de videollamadas WebRTC activo`);
    console.log(`📋 Sistema de tareas activo`);
    console.log(`📊 Sistema de estadísticas activo`);
    console.log(`🏆 Sistema de logros activo`);
});

// Manejo de errores
process.on('unhandledRejection', (err) => {
    console.error('❌ Error no manejado:', err);
});

module.exports = { app, server, io };