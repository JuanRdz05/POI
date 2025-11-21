// chatManager.js - Sistema de Chat Optimizado
class ChatManagerDB {
    constructor() {
        this.chats = [];
        this.chatActual = null;
        this.mensajesActuales = [];
        this.usuariosDisponibles = [];
        this.usuariosSeleccionadosGrupo = [];
        this.socket = null;
        this.mensajesNoLeidos = {};
        
        this.init();
    }

    async init() {
        await this.verificarAutenticacion();
        this.usuarioActual = sesionManager.user; // ✅ NUEVO: Guardar info del usuario
        await this.solicitarPermisosNotificaciones();
        await this.conectarWebSocket();
        await this.cargarUsuariosDisponibles();
        await this.cargarChats();
        this.configurarEventListeners();
        this.mostrarVistaChats();
    }

    configurarEventos() {
        // Evento del botón de adjuntar
        const attachButton = document.querySelector('.attach-button');
        if (attachButton) {
            attachButton.addEventListener('click', () => this.mostrarOpcionesAdjuntar());
        }

        // Resto de eventos existentes...
        const sendButton = document.querySelector('.send-button');
        const messageInput = document.querySelector('.message-input');
        
        if (sendButton) {
            sendButton.addEventListener('click', () => this.enviarMensaje());
        }
        
        if (messageInput) {
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.enviarMensaje();
                }
            });
        }
    }

    async verificarAutenticacion() {
        if (!sesionManager || !sesionManager.isAuthenticated()) {
            window.location.href = '/login';
            return;
        }
    }

    async solicitarPermisosNotificaciones() {
        if ('Notification' in window && Notification.permission === 'default') {
            await Notification.requestPermission();
        }
    }

    async conectarWebSocket() {
    try {
        this.socket = io("/");

        this.socket.on('connect', () => {
            console.log("✅ Conectado al servidor WebSocket");
            if(sesionManager.user && sesionManager.user.id) {
                this.socket.emit('join-user', sesionManager.user.id);
            }
        });

        this.socket.on('receive-private-message', (data) => {
            console.log("📩 Mensaje privado recibido:", data);
            this.manejarMensajeRecibido(data);
        });

        this.socket.on('receive-group-message', (data) => {
            console.log("👥 Mensaje grupal recibido:", data);
            this.manejarMensajeGrupalRecibido(data);
        });

        // ✅ Listener para nuevas tareas
        this.socket.on('nueva-tarea', (data) => {
            console.log("📋 Nueva tarea recibida vía WebSocket:", data);
            this.manejarNuevaTarea(data);
        });

        // ✅ NUEVO: Listener para actualizaciones de tareas
        this.socket.on('tarea-actualizada', (data) => {
            console.log("✅ Tarea actualizada vía WebSocket:", data);
            this.manejarActualizacionTarea(data);
        });

        this.socket.on('incoming-call', (data) => {
            console.log("📞 Llamada entrante:", data);
            this.manejarLlamadaEntrante(data);
        });

        this.socket.on('disconnect', () => {
            console.log("❌ Desconectado del servidor");
        });

    } catch(error) {
        console.error("❌ Error al conectar WebSocket:", error);
    }
}

manejarActualizacionTarea(data) {
    console.log("🔄 Actualizando tarea:", data);
    
    // Solo actualizar si estamos en el chat correcto
    if (this.chatActual && this.chatActual.id_chat == data.chatId) {
        const tareaElement = document.querySelector(`[data-tarea-id="${data.tarea.id}"]`);
        
        if (tareaElement) {
            const nuevoEstado = data.tarea.estado;
            
            // Actualizar clase del elemento
            tareaElement.className = `message task-message ${nuevoEstado}`;
            
            // Actualizar badge de estado
            const estadoSpan = tareaElement.querySelector('.task-status');
            if (estadoSpan) {
                estadoSpan.textContent = this.obtenerTextoEstado(nuevoEstado);
                estadoSpan.className = `task-status ${nuevoEstado}`;
            }

            // Actualizar botón
            const taskCheck = tareaElement.querySelector('.task-check');
            if (taskCheck) {
                if (nuevoEstado === 'terminada') {
                    taskCheck.outerHTML = `
                        <span class="task-check" style="color: #4CAF50; cursor: default;">
                            <i class="fas fa-check-circle"></i>
                        </span>
                    `;
                } else {
                    const icono = nuevoEstado === 'en_progreso' ? 'fa-spinner fa-spin' : 'fa-check-circle';
                    const siguienteEstado = nuevoEstado === 'pendiente' ? 'en_progreso' : 'terminada';
                    taskCheck.innerHTML = `<i class="far ${icono}"></i>`;
                    taskCheck.setAttribute('onclick', `chatManagerDB.cambiarEstadoTarea(${data.tarea.id}, '${siguienteEstado}')`);
                }
            }
            
            console.log(`✅ Tarea ${data.tarea.id} actualizada visualmente a estado: ${nuevoEstado}`);
        }
    }
}

async mostrarConfigEncriptacion() {
    if (!this.chatActual) {
        Swal.fire({
            icon: 'warning',
            title: 'Selecciona un chat',
            text: 'Primero debes seleccionar un chat',
            confirmButtonColor: '#D32F2F'
        });
        return;
    }

    const isEncrypted = encryptionManager.isChatEncrypted(this.chatActual.id_chat);
    
    const result = await Swal.fire({
        title: '🔐 Encriptación de mensajes',
        html: `
            <div style="text-align: left; padding: 20px;">
                <p style="margin-bottom: 15px;">
                    ${isEncrypted ? 
                        '✅ <strong>Este chat tiene encriptación activada</strong>' :
                        '⚠️ <strong>Este chat NO está encriptado</strong>'}
                </p>
                
                <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                    <h4 style="margin-top: 0;">ℹ️ ¿Qué es la encriptación?</h4>
                    <ul style="text-align: left; font-size: 14px; line-height: 1.6;">
                        <li>Los mensajes se encriptan antes de enviarse al servidor</li>
                        <li>Solo los participantes del chat pueden leer los mensajes</li>
                        <li>Usa encriptación AES-256 (estándar militar)</li>
                        <li>Las claves se guardan localmente en tu dispositivo</li>
                    </ul>
                </div>
                
                ${isEncrypted ? `
                    <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107;">
                        <strong>⚠️ Advertencia:</strong><br>
                        Si desactivas la encriptación, los mensajes antiguos encriptados no podrán leerse.
                    </div>
                ` : `
                    <div style="background: #d1ecf1; padding: 15px; border-radius: 8px; border-left: 4px solid #17a2b8;">
                        <strong>💡 Nota:</strong><br>
                        Al activar la encriptación, solo los mensajes nuevos estarán protegidos.
                    </div>
                `}
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: isEncrypted ? '🔓 Desactivar encriptación' : '🔐 Activar encriptación',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: isEncrypted ? '#D32F2F' : '#4CAF50',
        cancelButtonColor: '#9E9E9E'
    });

    if (result.isConfirmed) {
        if (isEncrypted) {
            await this.desactivarEncriptacion();
        } else {
            await this.activarEncriptacion();
        }
    }
}

async activarEncriptacion() {
    try {
        Swal.fire({
            title: 'Generando clave de encriptación...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        // Generar nueva clave
        const chatKey = await encryptionManager.generateChatKey();
        
        // Guardar clave localmente
        encryptionManager.saveChatKey(this.chatActual.id_chat, chatKey);
        encryptionManager.saveEncryptionPreference(this.chatActual.id_chat, true);
        
        // Actualizar en la base de datos
        await fetch(`/api/chats/${this.chatActual.id_chat}/encryption`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...sesionManager.getAuthHeaders()
            },
            body: JSON.stringify({ encrypted: true })
        });

        // Actualizar UI
        this.actualizarIndicadorEncriptacion(true);

        Swal.fire({
            icon: 'success',
            title: '🔐 Encriptación activada',
            text: 'Los nuevos mensajes estarán protegidos',
            timer: 2000,
            showConfirmButton: false
        });

    } catch (error) {
        console.error('Error activando encriptación:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo activar la encriptación',
            confirmButtonColor: '#D32F2F'
        });
    }
}

// 🔓 Desactivar encriptación
async desactivarEncriptacion() {
    try {
        Swal.fire({
            title: 'Desactivando encriptación...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        // Eliminar clave local
        encryptionManager.removeChatKey(this.chatActual.id_chat);
        encryptionManager.saveEncryptionPreference(this.chatActual.id_chat, false);
        
        // Actualizar en la base de datos
        await fetch(`/api/chats/${this.chatActual.id_chat}/encryption`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...sesionManager.getAuthHeaders()
            },
            body: JSON.stringify({ encrypted: false })
        });

        // Actualizar UI
        this.actualizarIndicadorEncriptacion(false);

        Swal.fire({
            icon: 'info',
            title: '🔓 Encriptación desactivada',
            text: 'Los mensajes ya no se encriptarán',
            timer: 2000,
            showConfirmButton: false
        });

    } catch (error) {
        console.error('Error desactivando encriptación:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo desactivar la encriptación',
            confirmButtonColor: '#D32F2F'
        });
    }
}

// 🔐 Actualizar indicador visual de encriptación
actualizarIndicadorEncriptacion(encrypted) {
    const chatHeader = document.querySelector('.chat-header-info');
    if (!chatHeader) return;

    // Remover indicador existente
    const existingBadge = chatHeader.querySelector('.encryption-badge');
    if (existingBadge) {
        existingBadge.remove();
    }

    // Agregar nuevo indicador si está encriptado
    if (encrypted) {
        const badge = document.createElement('span');
        badge.className = 'encryption-badge';
        badge.innerHTML = '🔐 Encriptado';
        badge.style.cssText = `
            display: inline-block;
            padding: 2px 8px;
            background: #4CAF50;
            color: white;
            border-radius: 10px;
            font-size: 11px;
            margin-left: 8px;
            font-weight: bold;
        `;
        chatHeader.appendChild(badge);
    }
}

async manejarLlamadaEntrante(data) {
    const { callId, from, tipo } = data;
    
    const tipoTexto = tipo === 'video' ? 'videollamada' : 'llamada de voz';
    const iconoTipo = tipo === 'video' ? 'fa-video' : 'fa-phone';
    
    // Reproducir sonido de llamada
    try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjaF0vLTgj');
        audio.loop = true;
        audio.play().catch(() => {});
        
        // Mostrar modal de llamada entrante
        const result = await Swal.fire({
            title: `${from.nombre} te está llamando`,
            html: `
                <div style="text-align: center;">
                    ${from.foto ? 
                        `<img src="../uploads/${from.foto}" alt="${from.nombre}" style="width: 100px; height: 100px; border-radius: 50%; margin: 20px auto;">` :
                        `<div style="width: 100px; height: 100px; border-radius: 50%; background: #4CAF50; color: white; display: flex; align-items: center; justify-content: center; margin: 20px auto; font-size: 40px; font-weight: bold;">${from.nombre.charAt(0)}</div>`
                    }
                    <p style="font-size: 18px; margin-top: 10px;">
                        <i class="fas ${iconoTipo}"></i> ${tipoTexto}
                    </p>
                </div>
            `,
            showCancelButton: true,
            confirmButtonColor: '#4CAF50',
            cancelButtonColor: '#D32F2F',
            confirmButtonText: `<i class="fas ${iconoTipo}"></i> Aceptar`,
            cancelButtonText: '<i class="fas fa-phone-slash"></i> Rechazar',
            allowOutsideClick: false
        });

        audio.pause();

        if (result.isConfirmed) {
            // Aceptar llamada
            await this.aceptarLlamada(callId, from, tipo);
        } else {
            // Rechazar llamada
            await this.rechazarLlamada(callId);
        }

    } catch (error) {
        console.error('Error manejando llamada entrante:', error);
    }
}

async aceptarLlamada(callId, from, tipo = 'audio') {
    try {
        const response = await fetch(`/api/videollamadas/aceptar/${callId}`, {
            method: 'POST',
            headers: sesionManager.getAuthHeaders()
        });

        if (response.ok) {
            // Guardar datos de la llamada
            localStorage.setItem('currentCall', JSON.stringify({
                callId: callId,
                remoteUser: from,
                isInitiator: false,
                tipo: tipo // 🔥 Guardar el tipo
            }));

            // Redirigir a la página de llamada
            window.location.href = '/llamada';
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudo aceptar la llamada',
                confirmButtonColor: '#D32F2F'
            });
        }

    } catch (error) {
        console.error('Error aceptando llamada:', error);
    }
}

async rechazarLlamada(callId) {
    try {
        await fetch(`/api/videollamadas/rechazar/${callId}`, {
            method: 'POST',
            headers: sesionManager.getAuthHeaders()
        });
    } catch (error) {
        console.error('Error rechazando llamada:', error);
    }
}

    async cargarUsuariosDisponibles() {
        try {
            const response = await fetch('/api/contactos/usuarios', {
                headers: sesionManager.getAuthHeaders()
            });

            if (response.ok) {
                const data = await response.json();
                this.usuariosDisponibles = data.usuarios || [];
                console.log(`✅ ${this.usuariosDisponibles.length} usuarios cargados`);
            }
        } catch (error) {
            console.error('❌ Error cargando usuarios:', error);
        }
    }

    async cargarChats() {
        try {
            const response = await fetch('/api/chats', {
                headers: sesionManager.getAuthHeaders()
            });

            if (response.ok) {
                const data = await response.json();
                this.chats = data.chats || [];
                console.log(`✅ ${this.chats.length} chats cargados`);
            } else {
                this.mostrarError('No se pudieron cargar los chats');
            }
        } catch (error) {
            console.error('❌ Error cargando chats:', error);
        }
    }

    async cargarMensajesChat(chatId) {
        try {
            const response = await fetch(`/api/chats/${chatId}/mensajes`, {
                headers: sesionManager.getAuthHeaders()
            });

            if (response.ok) {
                const data = await response.json();
                this.mensajesActuales = data.mensajes || [];
                this.mostrarMensajes();
                
                // 🔥 NUEVO: Marcar mensajes como leídos
                this.mensajesNoLeidos[chatId] = 0;
                this.actualizarBadgeChat(chatId);
                
                console.log(`✅ ${this.mensajesActuales.length} mensajes cargados`);
            } else {
                this.mensajesActuales = [];
                this.mostrarMensajes();
            }
        } catch (error) {
            console.error('❌ Error cargando mensajes:', error);
            this.mensajesActuales = [];
            this.mostrarMensajes();
        }
    }

    async cargarTareasChat(chatId) {
    try {
        const response = await fetch(`/api/tareas/chat/${chatId}`, {
            headers: sesionManager.getAuthHeaders()
        });

        if (response.ok) {
            const data = await response.json();
            const tareas = data.tareas || [];
            
            console.log(`✅ ${tareas.length} tareas cargadas`);
            
            // Agregar cada tarea a la UI
            tareas.forEach(tarea => {
                this.agregarMensajeTareaAUI({
                    id: tarea.id,
                    titulo: tarea.titulo,
                    descripcion: tarea.descripcion,
                    nombre_asignado: tarea.nombre_asignado,
                    estado: tarea.estado,
                    timestamp: tarea.fecha_creacion,
                    tipo: 'tarea',
                    enviado: false
                });
            });
        }
    } catch (error) {
        console.error('❌ Error cargando tareas:', error);
    }
}

    configurarEventListeners() {
        document.getElementById('new-chat').addEventListener('click', () => this.mostrarModalNuevoChat());
        document.getElementById('new-group').addEventListener('click', () => this.mostrarModalNuevoGrupo());
        
        document.querySelector('.send-button').addEventListener('click', () => this.enviarMensaje());
        document.querySelector('.message-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.enviarMensaje();
        });
        
        document.querySelector('.attach-button').addEventListener('click', () => {
            if (this.chatActual) this.mostrarOpcionesAdjuntar();
        });
    }

    mostrarVistaChats() {
        const contactsList = document.querySelector('.contacts-list');
        
        if (this.chats.length === 0) {
            contactsList.innerHTML = `
                <div class="no-contacts">
                    <i class="fas fa-comments" style="font-size: 48px; color: #ccc; margin-bottom: 10px;"></i>
                    <p>No tienes chats todavía</p>
                    <p>Haz clic en <i class="fas fa-comment"></i> para empezar una conversación</p>
                </div>
            `;
            return;
        }

        let html = '';
        this.chats.forEach(chat => {
            html += chat.tipo === 'privado' ? 
                this.crearHTMLChatPrivado(chat) : 
                this.crearHTMLChatGrupal(chat);
        });
        
        contactsList.innerHTML = html;
        
        this.chats.forEach(chat => {
            const elemento = document.querySelector(`[data-chat-id="${chat.id_chat}"]`);
            if (elemento) {
                elemento.addEventListener('click', () => this.seleccionarChat(chat));
                
                if (chat.tipo === 'grupal') {
                    const avatar = elemento.querySelector('.group-avatar');
                    if (avatar) {
                        avatar.addEventListener('click', (e) => {
                            e.stopPropagation();
                            this.mostrarIntegrantesGrupo(chat.id_chat);
                        });
                    }
                }
            }
        });
    }

    crearHTMLChatPrivado(chat) {
        const nombre = chat.nombreUsuario || chat.nombre || 'Usuario';
        const avatar = chat.foto ? 
            `<img src="../uploads/${chat.foto}" alt="${nombre}" class="contact-avatar-img">` :
            `<div class="contact-avatar-iniciales">${nombre.charAt(0)}</div>`;
        
        const ultimoMensaje = chat.ultimo_mensaje ? 
            (chat.ultimo_mensaje.length > 30 ? chat.ultimo_mensaje.substring(0, 30) + '...' : chat.ultimo_mensaje) :
            'Iniciar conversación';
        
        // 🔥 NUEVO: Badge de mensajes no leídos
        const noLeidos = this.mensajesNoLeidos[chat.id_chat] || 0;
        const badgeHTML = noLeidos > 0 ? `<span class="unread-badge">${noLeidos}</span>` : '';
        
        return `
            <div class="contact-item" data-chat-id="${chat.id_chat}">
                ${avatar}
                <div class="contact-info">
                    <div class="contact-name">${nombre}</div>
                    <div class="contact-lastmsg">${ultimoMensaje}</div>
                </div>
                ${chat.estado_conexion === 'online' ? '<div class="online-indicator" title="En línea"></div>' : ''}
                ${badgeHTML}
            </div>
        `;
    }

    crearHTMLChatGrupal(chat) {
        const nombre = chat.nombre_grupo || 'Grupo';
        const ultimoMensaje = chat.ultimo_mensaje ? 
            (chat.ultimo_mensaje.length > 30 ? chat.ultimo_mensaje.substring(0, 30) + '...' : chat.ultimo_mensaje) :
            `${chat.cantidad_miembros || 0} miembros`;
        
        // 🔥 NUEVO: Badge de mensajes no leídos
        const noLeidos = this.mensajesNoLeidos[chat.id_chat] || 0;
        const badgeHTML = noLeidos > 0 ? `<span class="unread-badge">${noLeidos}</span>` : '';
        
        return `
            <div class="contact-item" data-chat-id="${chat.id_chat}">
                <div class="contact-avatar-grupo group-avatar" data-chat-id="${chat.id_chat}">
                    <i class="fas fa-users"></i>
                </div>
                <div class="contact-info">
                    <div class="contact-name">${nombre}</div>
                    <div class="contact-lastmsg">${ultimoMensaje}</div>
                </div>
                ${badgeHTML}
            </div>
        `;
    }

    async seleccionarChat(chat) {
    this.chatActual = chat;
    
    if (chat.tipo === 'grupal' && this.socket) {
        this.socket.emit('join-group', chat.id_chat);
        console.log(`👥 Uniéndose a chat-${chat.id_chat}`);
    }
    
    if (chat.tipo === 'privado') {
        this.mostrarChatPrivado(chat);
    } else {
        this.mostrarChatGrupal(chat);
    }
    
    await this.cargarMensajesChat(chat.id_chat);
    
    // ✅ NUEVO: Cargar tareas si es un chat grupal
    if (chat.tipo === 'grupal') {
        await this.cargarTareasChat(chat.id_chat);
    }
    
    document.querySelectorAll('.contact-item').forEach(item => item.classList.remove('active'));
    document.querySelector(`[data-chat-id="${chat.id_chat}"]`)?.classList.add('active');
    document.querySelector('.chat-panel').classList.add('active');
}

    mostrarChatPrivado(chat) {
    const chatHeader = document.querySelector('.chat-header');
    const nombre = chat.nombre || 'Usuario';
    const avatar = chat.foto ? 
        `<img src="../uploads/${chat.foto}" alt="${nombre}" class="chat-avatar-img">` :
        `<div class="chat-avatar-iniciales">${nombre.charAt(0)}</div>`;
    
    const userId = chat.id_usuario || chat.id_receptor || chat.id_emisor || chat.id;
    const isEncrypted = encryptionManager.isChatEncrypted(chat.id_chat);
    
    chatHeader.innerHTML = `
        <div class="chat-header-content">
            <button class="back-button" title="Volver a contactos">
                <i class="fas fa-arrow-left"></i>
            </button>
            ${avatar}
            <div class="chat-header-info">
                <div class="chat-contact-name">
                    ${nombre}
                    ${isEncrypted ? '<span class="encryption-badge" style="display: inline-block; padding: 2px 8px; background: #4CAF50; color: white; border-radius: 10px; font-size: 11px; margin-left: 8px; font-weight: bold;">🔐 Encriptado</span>' : ''}
                </div>
                <div class="chat-contact-status">${chat.estado_conexion === 'online' ? 'En línea' : 'Desconectado'}</div>
            </div>
        </div>
        <div class="chat-header-actions">
            <button class="chat-action-btn call-btn" title="Llamar (Audio)" data-user-id="${userId}" data-type="audio">
                <i class="fas fa-phone"></i>
            </button>
            <button class="chat-action-btn video-btn" title="Videollamada" data-user-id="${userId}" data-type="video">
                <i class="fas fa-video"></i>
            </button>
            <button class="chat-action-btn encryption-btn" title="Configurar encriptación">
                <i class="fas ${isEncrypted ? 'fa-lock' : 'fa-unlock'}"></i>
            </button>
            <button class="chat-action-btn" title="Opciones">
                <i class="fas fa-ellipsis-v"></i>
            </button>
        </div>
    `;

    chatHeader.querySelector('.back-button').addEventListener('click', () => this.volverAContactos());
    
    const callBtn = chatHeader.querySelector('.call-btn');
    callBtn.addEventListener('click', () => this.iniciarLlamada(chat, 'audio'));
    
    const videoBtn = chatHeader.querySelector('.video-btn');
    videoBtn.addEventListener('click', () => this.iniciarLlamada(chat, 'video'));
    
    // 🔐 NUEVO: Botón de encriptación
    const encryptionBtn = chatHeader.querySelector('.encryption-btn');
    encryptionBtn.addEventListener('click', () => this.mostrarConfigEncriptacion());
}


async iniciarLlamada(chat, tipo = 'audio') {
    try {
        const tipoTexto = tipo === 'video' ? 'videollamada' : 'llamada de voz';
        
        // Confirmar antes de llamar
        const result = await Swal.fire({
            title: `¿${tipo === 'video' ? 'Videollamar' : 'Llamar'} a ${chat.nombre}?`,
            text: `Se iniciará una ${tipoTexto}`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#4CAF50',
            cancelButtonColor: '#9E9E9E',
            confirmButtonText: `Sí, ${tipo === 'video' ? 'videollamar' : 'llamar'}`,
            cancelButtonText: 'Cancelar'
        });

        if (!result.isConfirmed) return;

        // Mostrar loading
        Swal.fire({
            title: `Iniciando ${tipoTexto}...`,
            text: 'Esperando respuesta',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        // Llamar al endpoint para iniciar la llamada
        const response = await fetch('/api/videollamadas/iniciar', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...sesionManager.getAuthHeaders()
            },
            body: JSON.stringify({
                id_receptor: chat.id_usuario,
                tipo: tipo // 'audio' o 'video'
            })
        });

        if (response.ok) {
            const data = await response.json();
            
            // Guardar datos de la llamada en localStorage
            localStorage.setItem('currentCall', JSON.stringify({
                callId: data.callId,
                remoteUser: {
                    id: chat.id_usuario,
                    nombre: chat.nombre,
                    foto: chat.foto
                },
                isInitiator: true,
                tipo: tipo // 🔥 Guardar el tipo de llamada
            }));

            // Redirigir a la página de llamada
            window.location.href = '/llamada';

        } else {
            const errorData = await response.json();
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: errorData.error || 'No se pudo iniciar la llamada',
                confirmButtonColor: '#D32F2F'
            });
        }

    } catch (error) {
        console.error('❌ Error iniciando llamada:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Error de conexión',
            confirmButtonColor: '#D32F2F'
        });
    }
}

    mostrarChatGrupal(chat) {
        const chatHeader = document.querySelector('.chat-header');
        const nombre = chat.nombre_grupo || 'Grupo';
        
        chatHeader.innerHTML = `
            <div class="chat-header-content">
                <button class="back-button" title="Volver a contactos">
                    <i class="fas fa-arrow-left"></i>
                </button>
                <div class="contact-avatar-grupo group-avatar-header">
                    <i class="fas fa-users"></i>
                </div>
                <div class="chat-header-info">
                    <div class="chat-contact-name">${nombre}</div>
                    <div class="chat-contact-status">${chat.cantidad_miembros || 0} miembros</div>
                </div>
            </div>
            <div class="chat-header-actions">
                <button class="chat-action-btn" title="Ver integrantes">
                    <i class="fas fa-info-circle"></i>
                </button>
            </div>
        `;

        chatHeader.querySelector('.back-button').addEventListener('click', () => this.volverAContactos());
        chatHeader.querySelector('.chat-action-btn').addEventListener('click', () => this.mostrarIntegrantesGrupo(chat.id_chat));
    }

async mostrarMensajes() {
    const messagesContainer = document.querySelector('.messages-container');
    
    if (this.mensajesActuales.length === 0) {
        messagesContainer.innerHTML = `
            <div class="no-messages">
                <p>No hay mensajes en este chat</p>
                <p>Envía un mensaje para comenzar la conversación</p>
            </div>
        `;
        return;
    }

    const chatKey = encryptionManager.getChatKey(this.chatActual.id_chat);
    
    // Desencriptar mensajes si es necesario
    for (let mensaje of this.mensajesActuales) {
        if (mensaje.encrypted && chatKey) {
            try {
                mensaje.contenido = await encryptionManager.decrypt(mensaje.contenido, chatKey);
            } catch (error) {
                console.error('Error desencriptando mensaje:', error);
                mensaje.contenido = '🔐 [Mensaje encriptado - No se pudo desencriptar]';
            }
        } else if (mensaje.encrypted && !chatKey) {
            mensaje.contenido = '🔐 [Mensaje encriptado - Clave no disponible]';
        }
    }
    
    messagesContainer.innerHTML = this.mensajesActuales.map(m => this.crearHTMLMensaje(m)).join('');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

    crearHTMLMensaje(mensaje) {
    // Si es una tarea, usar el método específico
    if (mensaje.tipo === 'tarea') {
        return this.crearHTMLMensajeTarea(mensaje);
    }

    const esMio = mensaje.enviado === true;
    const clase = esMio ? 'message sent' : 'message received';
    
    let contenidoHTML = '';
    
    // Manejar diferentes tipos de mensajes
    switch (mensaje.tipo) {
        case 'imagen':
            contenidoHTML = `
                <div class="message-image">
                    <img src="${mensaje.url}" alt="${mensaje.contenido}" 
                         onclick="window.open('${mensaje.url}', '_blank')"
                         style="max-width: 300px; max-height: 300px; cursor: pointer; border-radius: 8px; display: block;">
                    <p style="font-size: 0.85em; margin-top: 5px; color: #666;">${mensaje.contenido}</p>
                </div>
            `;
            break;

        case 'archivo':
            const extension = mensaje.contenido.split('.').pop().toLowerCase();
            let iconoArchivo = 'fa-file';
            
            if (['pdf'].includes(extension)) iconoArchivo = 'fa-file-pdf';
            else if (['doc', 'docx'].includes(extension)) iconoArchivo = 'fa-file-word';
            else if (['xls', 'xlsx'].includes(extension)) iconoArchivo = 'fa-file-excel';
            else if (['zip', 'rar'].includes(extension)) iconoArchivo = 'fa-file-archive';
            else if (['txt'].includes(extension)) iconoArchivo = 'fa-file-alt';
            
            contenidoHTML = `
                <div class="message-file" style="display: flex; align-items: center; gap: 10px; padding: 10px; background: rgba(0,0,0,0.05); border-radius: 8px;">
                    <i class="fas ${iconoArchivo}" style="font-size: 2em; color: #2196F3;"></i>
                    <div style="flex: 1;">
                        <p style="margin: 0; font-weight: bold;">${mensaje.contenido}</p>
                    </div>
                    <a href="${mensaje.url}" download="${mensaje.contenido}" 
                       class="btn-download" style="padding: 8px 15px; background: #4CAF50; color: white; border-radius: 5px; text-decoration: none;">
                        <i class="fas fa-download"></i> Descargar
                    </a>
                </div>
            `;
            break;

        case 'ubicacion':
            contenidoHTML = `
                <div class="message-location" style="padding: 10px;">
                    <p style="margin: 0 0 10px 0;"><i class="fas fa-map-marker-alt"></i> ${mensaje.contenido}</p>
                    <a href="${mensaje.url}" target="_blank" 
                       style="display: inline-block; padding: 8px 15px; background: #FF9800; color: white; border-radius: 5px; text-decoration: none;">
                        <i class="fas fa-external-link-alt"></i> Ver en Google Maps
                    </a>
                </div>
            `;
            break;

        default:
            contenidoHTML = `<div class="message-content">${mensaje.contenido}</div>`;
    }
    
    const mostrarRemitente = this.chatActual && 
        this.chatActual.tipo === 'grupal' && 
        !esMio && 
        mensaje.nombre_remitente;
    
    return `
        <div class="${clase}">
            ${mostrarRemitente ? `<div class="message-sender">${mensaje.nombre_remitente}</div>` : ''}
            ${contenidoHTML}
            <div class="message-time">${this.formatearHora(mensaje.timestamp)}</div>
        </div>
    `;
}

    crearHTMLMensajeTarea(mensaje) {
    // Parsear el contenido si viene como JSON string
    let tareaData = mensaje;
    if (typeof mensaje.contenido === 'string') {
        try {
            tareaData = JSON.parse(mensaje.contenido);
        } catch (e) {
            tareaData = mensaje;
        }
    }

    const estadoClase = tareaData.estado || 'pendiente';
    const esCompletada = estadoClase === 'terminada';
    
    return `
        <div class="message task-message ${estadoClase}" data-tarea-id="${tareaData.id || mensaje.id}">
            <div class="task-header">
                <div class="task-title">📋 ${tareaData.titulo || mensaje.titulo || 'Tarea'}</div>
                ${!esCompletada ? `
                    <button class="task-check" onclick="chatManagerDB.cambiarEstadoTarea(${tareaData.id || mensaje.id}, '${estadoClase === 'pendiente' ? 'en_progreso' : 'terminada'}')">
                        <i class="far ${estadoClase === 'en_progreso' ? 'fa-spinner fa-spin' : 'fa-check-circle'}"></i>
                    </button>
                ` : `
                    <span class="task-check" style="color: #4CAF50; cursor: default;">
                        <i class="fas fa-check-circle"></i>
                    </span>
                `}
            </div>
            ${tareaData.descripcion ? `<div class="task-description">${tareaData.descripcion}</div>` : ''}
            <div class="task-info" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(0,0,0,0.1); font-size: 0.85em;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span>👤 Asignado a: <strong>${tareaData.nombre_asignado || 'N/A'}</strong></span>
                    <span class="task-status ${estadoClase}">${this.obtenerTextoEstado(estadoClase)}</span>
                </div>
            </div>
            <div class="message-time">${this.formatearHora(mensaje.timestamp || tareaData.fecha_creacion)}</div>
        </div>
    `;
}

manejarNuevaTarea(data) {
    console.log("📋 Nueva tarea recibida:", data);
    
    if (this.chatActual && this.chatActual.id_chat == data.chatId) {
        const mensajeTarea = {
            id: data.tarea.id,
            titulo: data.tarea.titulo,
            descripcion: data.tarea.descripcion,
            nombre_asignado: data.tarea.nombre_asignado,
            estado: data.tarea.estado,
            timestamp: data.tarea.fecha_creacion,
            tipo: 'tarea',
            enviado: data.tarea.asignado_a === sesionManager.user.id
        };
        
        this.agregarMensajeTareaAUI(mensajeTarea);
    }
}

// ✅ NUEVO: Agregar mensaje de tarea a la UI
agregarMensajeTareaAUI(tarea) {
    const messagesContainer = document.querySelector('.messages-container');
    if (!messagesContainer) return;

    const tareaHTML = this.crearHTMLMensajeTarea(tarea);
    messagesContainer.insertAdjacentHTML('beforeend', tareaHTML);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}


    formatearHora(timestamp) {
        return new Date(timestamp).toLocaleTimeString('es-MX', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    // 🔥 OPTIMIZADO: Enviar mensaje con WebSocket
    async enviarMensaje() {
    const input = document.querySelector('.message-input');
    const texto = input.value.trim();
    
    if (!texto || !this.chatActual) return;
    
    try {
        let contenidoFinal = texto;
        let esEncriptado = false;

        // Verificar si el chat tiene encriptación activada
        const chatKey = encryptionManager.getChatKey(this.chatActual.id_chat);
        
        if (chatKey) {
            // Encriptar el mensaje
            contenidoFinal = await encryptionManager.encrypt(texto, chatKey);
            esEncriptado = true;
            console.log('🔐 Mensaje encriptado antes de enviar');
        }

        const response = await fetch(`/api/chats/${this.chatActual.id_chat}/mensajes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...sesionManager.getAuthHeaders()
            },
            body: JSON.stringify({
                contenido: contenidoFinal,
                tipo: 'texto',
                encrypted: esEncriptado
            })
        });

        if (response.ok) {
            const data = await response.json();
            
            // Si estaba encriptado, desencriptar para mostrar
            if (esEncriptado) {
                data.mensaje.contenido = texto; // Usar el texto original
                data.mensaje.encrypted = true;
            }
            
            this.agregarMensajeAUI(data.mensaje);
            input.value = '';
            
            await this.actualizarUltimoMensajeChat(this.chatActual.id_chat, 
                esEncriptado ? '🔐 Mensaje encriptado' : texto);
        } else {
            this.mostrarError('Error al enviar mensaje');
        }
    } catch (error) {
        console.error('❌ Error enviando mensaje:', error);
        this.mostrarError('Error de conexión');
    }
}

    // 🔥 NUEVO: Actualizar último mensaje sin recargar toda la lista
    async actualizarUltimoMensajeChat(chatId, mensaje) {
        const chatItem = document.querySelector(`[data-chat-id="${chatId}"] .contact-lastmsg`);
        if (chatItem) {
            const mensajeCorto = mensaje.length > 30 ? mensaje.substring(0, 30) + '...' : mensaje;
            chatItem.textContent = mensajeCorto;
        }
    }

    // 🔥 OPTIMIZADO: Agregar mensaje a UI sin recargar
    // agregarMensajeAUI(mensaje) {
    //     const messagesContainer = document.querySelector('.messages-container');
        
    //     // Remover mensaje de "no hay mensajes" si existe
    //     const noMessages = messagesContainer.querySelector('.no-messages');
    //     if (noMessages) {
    //         messagesContainer.innerHTML = '';
    //     }
        
    //     // Crear y agregar nuevo mensaje
    //     const mensajeHTML = this.crearHTMLMensaje(mensaje);
    //     messagesContainer.insertAdjacentHTML('beforeend', mensajeHTML);
        
    //     // Scroll automático
    //     messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
    //     // Actualizar array local
    //     this.mensajesActuales.push(mensaje);
    // }

    agregarMensajeAUI(mensaje) {
        const messagesContainer = document.querySelector('.messages-container');
        if (!messagesContainer) return;

        // ✅ FIX: Usar sesionManager en lugar de this.usuarioActual
        const userId = sesionManager.user?.id || this.usuarioActual?.id;
        const esEnviado = mensaje.enviado || mensaje.remitente?.id === userId;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${esEnviado ? 'sent' : 'received'}`;
        messageDiv.dataset.messageId = mensaje.id;

        let contenidoHTML = '';

        // Manejar diferentes tipos de mensajes
        switch (mensaje.tipo) {
            case 'imagen':
                contenidoHTML = `
                    <div class="message-image">
                        <img src="${mensaje.url}" alt="${mensaje.contenido}" 
                             onclick="window.open('${mensaje.url}', '_blank')"
                             style="max-width: 300px; max-height: 300px; cursor: pointer; border-radius: 8px; display: block;">
                        <p style="font-size: 0.85em; margin-top: 5px; color: #666;">${mensaje.contenido}</p>
                    </div>
                `;
                break;

            case 'archivo':
                const extension = mensaje.contenido.split('.').pop().toLowerCase();
                let iconoArchivo = 'fa-file';
                
                if (['pdf'].includes(extension)) iconoArchivo = 'fa-file-pdf';
                else if (['doc', 'docx'].includes(extension)) iconoArchivo = 'fa-file-word';
                else if (['xls', 'xlsx'].includes(extension)) iconoArchivo = 'fa-file-excel';
                else if (['zip', 'rar'].includes(extension)) iconoArchivo = 'fa-file-archive';
                else if (['txt'].includes(extension)) iconoArchivo = 'fa-file-alt';
                
                contenidoHTML = `
                    <div class="message-file" style="display: flex; align-items: center; gap: 10px; padding: 10px; background: rgba(0,0,0,0.05); border-radius: 8px;">
                        <i class="fas ${iconoArchivo}" style="font-size: 2em; color: #2196F3;"></i>
                        <div style="flex: 1;">
                            <p style="margin: 0; font-weight: bold;">${mensaje.contenido}</p>
                            ${mensaje.tamañoArchivo ? `<p style="margin: 0; font-size: 0.85em; color: #666;">${this.formatearTamaño(mensaje.tamañoArchivo)}</p>` : ''}
                        </div>
                        <a href="${mensaje.url}" download="${mensaje.contenido}" 
                           class="btn-download" style="padding: 8px 15px; background: #4CAF50; color: white; border-radius: 5px; text-decoration: none;">
                            <i class="fas fa-download"></i> Descargar
                        </a>
                    </div>
                `;
                break;

            case 'ubicacion':
                contenidoHTML = `
                    <div class="message-location" style="padding: 10px;">
                        <p style="margin: 0 0 10px 0;"><i class="fas fa-map-marker-alt"></i> ${mensaje.contenido}</p>
                        <a href="${mensaje.url}" target="_blank" 
                           style="display: inline-block; padding: 8px 15px; background: #FF9800; color: white; border-radius: 5px; text-decoration: none;">
                            <i class="fas fa-external-link-alt"></i> Ver en Google Maps
                        </a>
                    </div>
                `;
                break;

            default:
                contenidoHTML = `<p>${mensaje.contenido}</p>`;
        }

        messageDiv.innerHTML = `
            ${!esEnviado && mensaje.nombre_remitente ? `<div class="sender-name" style="font-size: 0.85em; color: #666; margin-bottom: 5px;">${mensaje.nombre_remitente}</div>` : ''}
            ${contenidoHTML}
            <span class="timestamp" style="font-size: 0.75em; color: #999; margin-top: 5px; display: block;">${this.formatearFecha(mensaje.timestamp)}</span>
        `;

        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }


    // 🔥 OPTIMIZADO: Manejar mensajes recibidos en tiempo real
   manejarMensajeRecibido(data) {
        console.log("📨 Procesando mensaje privado:", data);
        
        // Si el chat está abierto, agregar mensaje
        if (this.chatActual && this.chatActual.id_chat == data.chatId) {
            this.agregarMensajeAUI({
                id: data.messageId,
                contenido: data.message,
                timestamp: data.timestamp || Date.now(),
                enviado: false,
                tipo: data.tipo || 'texto',
                url: data.url
            });
        } else {
            // 🔥 NUEVO: Si el chat NO está abierto, aumentar contador
            this.mensajesNoLeidos[data.chatId] = (this.mensajesNoLeidos[data.chatId] || 0) + 1;
            this.actualizarBadgeChat(data.chatId);
            
            // 🔥 Mover chat al inicio de la lista
            this.moverChatAlInicio(data.chatId);
            
            // 🔥 Mostrar notificación del navegador
            this.mostrarNotificacionNavegador('Nuevo mensaje', data.message);
            
            // 🔥 Reproducir sonido (opcional)
            this.reproducirSonidoNotificacion();
        }
        
        this.actualizarUltimoMensajeChat(data.chatId, data.message);
    }

    // 🔥 OPTIMIZADO: Manejar mensajes grupales en tiempo real
    manejarMensajeGrupalRecibido(data) {
        console.log("💥 Procesando mensaje grupal:", data);
        
        if (this.chatActual && this.chatActual.id_chat == data.chatId) {
            this.agregarMensajeAUI({
                id: data.messageId,
                contenido: data.message,
                timestamp: data.timestamp || Date.now(),
                enviado: false,
                tipo: 'texto',
                nombre_remitente: data.nombreRemitente
            });
        } else {
            // 🔥 NUEVO: Aumentar contador y notificar
            this.mensajesNoLeidos[data.chatId] = (this.mensajesNoLeidos[data.chatId] || 0) + 1;
            this.actualizarBadgeChat(data.chatId);
            this.moverChatAlInicio(data.chatId);
            this.mostrarNotificacionNavegador(`${data.nombreRemitente} (Grupo)`, data.message);
            this.reproducirSonidoNotificacion();
        }
        
        this.actualizarUltimoMensajeChat(data.chatId, data.message);
    }

    formatearTamaño(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    formatearFecha(timestamp) {
        const fecha = new Date(timestamp);
        return fecha.toLocaleTimeString('es-MX', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    actualizarBadgeChat(chatId) {
        const chatElement = document.querySelector(`[data-chat-id="${chatId}"]`);
        if (!chatElement) return;
        
        const noLeidos = this.mensajesNoLeidos[chatId] || 0;
        let badge = chatElement.querySelector('.unread-badge');
        
        if (noLeidos > 0) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'unread-badge';
                chatElement.appendChild(badge);
            }
            badge.textContent = noLeidos;
        } else {
            if (badge) {
                badge.remove();
            }
        }
    }

    moverChatAlInicio(chatId) {
        const chatIndex = this.chats.findIndex(c => c.id_chat == chatId);
        if (chatIndex > 0) {
            const [chat] = this.chats.splice(chatIndex, 1);
            this.chats.unshift(chat);
            this.mostrarVistaChats();
        }
    }

    mostrarNotificacionNavegador(titulo, mensaje) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(titulo, {
                body: mensaje.substring(0, 100),
                icon: '../IMAGENES/logo.png',
                tag: 'chat-notification'
            });
        }
    }

    reproducirSonidoNotificacion() {
        try {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjaF0vLTgj');
            audio.play().catch(() => {}); // Ignorar errores si el navegador bloquea el sonido
        } catch (error) {
            console.log('No se pudo reproducir el sonido');
        }
    }


    mostrarOpcionesAdjuntar() {
        Swal.fire({
            title: 'Adjuntar archivo',
            html: `
                <div style="display: flex; flex-direction: column; gap: 15px;">
                    <button id="btn-imagen" class="swal2-styled" style="background: #4CAF50;">
                        <i class="fas fa-image"></i> Imagen
                    </button>
                    <button id="btn-archivo" class="swal2-styled" style="background: #2196F3;">
                        <i class="fas fa-file"></i> Documento
                    </button>
                    <button id="btn-ubicacion" class="swal2-styled" style="background: #FF9800;">
                        <i class="fas fa-map-marker-alt"></i> Ubicación
                    </button>
                    <button id="btn-tarea" class="swal2-styled" style="background: #FFC107;">
                        <i class="fas fa-tasks"></i> Tarea
                    </button>
                </div>
            `,
            showConfirmButton: false,
            showCloseButton: true,
            didOpen: () => {
                document.getElementById('btn-imagen').addEventListener('click', () => {
                    Swal.close();
                    this.seleccionarArchivo('image/*');
                });
                
                document.getElementById('btn-archivo').addEventListener('click', () => {
                    Swal.close();
                    this.seleccionarArchivo('.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar');
                });
                
                document.getElementById('btn-ubicacion').addEventListener('click', () => {
                    Swal.close();
                    this.enviarUbicacion();
                });
                // 🔥 NUEVO: Evento del botón de tareas
                document.getElementById('btn-tarea').addEventListener('click', () => {
                    Swal.close();
                    this.mostrarModalCrearTarea();
                });
            }
        });
    }

    async mostrarModalCrearTarea() {
    if (!this.chatActual || this.chatActual.tipo !== 'grupal') {
        Swal.fire({
            icon: 'warning',
            title: 'Solo en grupos',
            text: 'Las tareas solo pueden crearse en chats grupales',
            confirmButtonColor: '#D32F2F'
        });
        return;
    }

    // Obtener miembros del grupo
    try {
        const response = await fetch(`/api/chats/${this.chatActual.id_chat}/integrantes`, {
            headers: sesionManager.getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error('Error cargando miembros');
        }

        const data = await response.json();
        const miembros = data.integrantes || [];

        // Crear opciones para el select
        const opcionesMiembros = miembros.map(m => 
            `<option value="${m.id_usuario}">${m.nombre} (@${m.nombreUsuario || 'usuario'})</option>`
        ).join('');

        const { value: formValues } = await Swal.fire({
            title: 'Crear nueva tarea',
            html: `
                <div style="text-align: left;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Título de la tarea:</label>
                    <input id="tarea-titulo" class="swal2-input" placeholder="Ej: Revisar estadísticas" 
                           style="width: 100%; margin: 0 0 15px 0;">
                    
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Descripción:</label>
                    <textarea id="tarea-descripcion" class="swal2-textarea" 
                              placeholder="Describe la tarea..." 
                              style="width: 100%; height: 100px; margin: 0 0 15px 0;"></textarea>
                    
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Asignar a:</label>
                    <select id="tarea-asignado" class="swal2-select" style="width: 100%; padding: 10px; margin: 0;">
                        ${opcionesMiembros}
                    </select>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Crear tarea',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#4CAF50',
            cancelButtonColor: '#9E9E9E',
            preConfirm: () => {
                const titulo = document.getElementById('tarea-titulo').value.trim();
                const descripcion = document.getElementById('tarea-descripcion').value.trim();
                const asignado = document.getElementById('tarea-asignado').value;

                if (!titulo) {
                    Swal.showValidationMessage('Debes escribir un título');
                    return false;
                }

                if (!asignado) {
                    Swal.showValidationMessage('Debes asignar la tarea a alguien');
                    return false;
                }

                return { titulo, descripcion, asignado };
            }
        });

        if (formValues) {
            await this.crearTarea(formValues.titulo, formValues.descripcion, formValues.asignado);
        }

    } catch (error) {
        console.error('Error mostrando modal de tarea:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo cargar los miembros del grupo',
            confirmButtonColor: '#D32F2F'
        });
    }
}


async crearTarea(titulo, descripcion, asignadoA) {
    if (!this.chatActual || !this.chatActual.id_grupo) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo identificar el grupo',
            confirmButtonColor: '#D32F2F'
        });
        return;
    }

    try {
        Swal.fire({
            title: 'Creando tarea...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        const response = await fetch('/api/tareas', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...sesionManager.getAuthHeaders()
            },
            body: JSON.stringify({
                id_grupo: this.chatActual.id_grupo,
                titulo: titulo,
                descripcion: descripcion,
                asignado_a: parseInt(asignadoA)
            })
        });

        if (response.ok) {
            const data = await response.json();
            
            Swal.fire({
                icon: 'success',
                title: 'Tarea creada',
                text: 'La tarea ha sido creada exitosamente',
                timer: 2000,
                showConfirmButton: false
            });

            // ✅ La tarea se agregará automáticamente vía WebSocket
            console.log('✅ Tarea creada:', data.tarea);
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error creando tarea');
        }

    } catch (error) {
        console.error('❌ Error creando tarea:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'No se pudo crear la tarea',
            confirmButtonColor: '#D32F2F'
        });
    }
}


async cambiarEstadoTarea(tareaId, nuevoEstado) {
    try {
        const response = await fetch(`/api/tareas/${tareaId}/estado`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...sesionManager.getAuthHeaders()
            },
            body: JSON.stringify({ estado: nuevoEstado })
        });

        if (response.ok) {
            const data = await response.json();
            console.log('✅ Estado de tarea actualizado:', data.tarea);
            
            // Actualizar visualmente la tarea en el chat
            const tareaElement = document.querySelector(`[data-tarea-id="${tareaId}"]`);
            if (tareaElement) {
                tareaElement.className = `message task-message ${nuevoEstado}`;
                
                const estadoSpan = tareaElement.querySelector('.task-status');
                if (estadoSpan) {
                    estadoSpan.textContent = this.obtenerTextoEstado(nuevoEstado);
                    estadoSpan.className = `task-status ${nuevoEstado}`;
                }

                // Actualizar botón
                const taskCheck = tareaElement.querySelector('.task-check');
                if (taskCheck && nuevoEstado === 'terminada') {
                    taskCheck.outerHTML = `
                        <span class="task-check" style="color: #4CAF50; cursor: default;">
                            <i class="fas fa-check-circle"></i>
                        </span>
                    `;
                } else if (taskCheck) {
                    const icono = nuevoEstado === 'en_progreso' ? 'fa-spinner fa-spin' : 'fa-check-circle';
                    const siguienteEstado = nuevoEstado === 'pendiente' ? 'en_progreso' : 'terminada';
                    taskCheck.innerHTML = `<i class="far ${icono}"></i>`;
                    taskCheck.setAttribute('onclick', `chatManagerDB.cambiarEstadoTarea(${tareaId}, '${siguienteEstado}')`);
                }
            }

            Swal.fire({
                icon: 'success',
                title: 'Estado actualizado',
                text: `Tarea marcada como ${this.obtenerTextoEstado(nuevoEstado)}`,
                timer: 1500,
                showConfirmButton: false
            });
        }
    } catch (error) {
        console.error('Error cambiando estado:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo actualizar el estado',
            confirmButtonColor: '#D32F2F'
        });
    }
}

obtenerTextoEstado(estado) {
    const estados = {
        'pendiente': '⏳ Pendiente',
        'en_progreso': '🔄 En progreso',
        'terminada': '✅ Terminada'
    };
    return estados[estado] || estado;
}

obtenerIconoEstado(estado) {
    const iconos = {
        'pendiente': 'fa-clock',
        'en_progreso': 'fa-spinner',
        'terminada': 'fa-check-circle'
    };
    return iconos[estado] || 'fa-circle';
}

    seleccionarArchivo(acceptTypes) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = acceptTypes;
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                // Validar tamaño (10MB máximo)
                if (file.size > 10 * 1024 * 1024) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Archivo muy grande',
                        text: 'El archivo no debe superar los 10MB'
                    });
                    return;
                }
                
                await this.subirArchivo(file);
            }
        };
        
        input.click();
    }

    async subirArchivo(file) {
    if (!this.chatActual) {
        Swal.fire({
            icon: 'warning',
            title: 'Selecciona un chat primero',
            confirmButtonColor: '#D32F2F'
        });
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
        Swal.fire({
            title: 'Subiendo archivo...',
            html: `
                <div style="margin: 20px 0;">
                    <p><strong>${file.name}</strong></p>
                    <p style="color: #666;">${this.formatearTamaño(file.size)}</p>
                </div>
                <div class="progress-bar" style="width: 100%; height: 4px; background: #eee; border-radius: 2px; overflow: hidden;">
                    <div style="height: 100%; background: #4CAF50; width: 0%; animation: progress 2s ease-in-out infinite;"></div>
                </div>
                <style>
                    @keyframes progress {
                        0% { width: 0%; }
                        50% { width: 70%; }
                        100% { width: 100%; }
                    }
                </style>
            `,
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        console.log('📤 Enviando archivo:', {
            nombre: file.name,
            tamaño: file.size,
            tipo: file.type,
            chatId: this.chatActual.id_chat
        });

        // ✅ SOLUCIÓN: Crear headers sin Content-Type
        const authHeaders = sesionManager.getAuthHeaders();
        const headersForUpload = {};
        
        // Solo copiar Authorization, NO Content-Type
        if (authHeaders.Authorization) {
            headersForUpload.Authorization = authHeaders.Authorization;
        }
        if (authHeaders['x-access-token']) {
            headersForUpload['x-access-token'] = authHeaders['x-access-token'];
        }

        const response = await fetch(`/api/chats/${this.chatActual.id_chat}/upload`, {
            method: 'POST',
            headers: headersForUpload, // ✅ Solo auth headers, sin Content-Type
            body: formData
        });

        console.log('📥 Respuesta del servidor:', response.status);

        if (response.ok) {
            const data = await response.json();
            console.log('✅ Archivo subido exitosamente:', data);
            
            this.agregarMensajeAUI(data.mensaje);
            
            Swal.fire({
                icon: 'success',
                title: 'Archivo enviado',
                timer: 1500,
                showConfirmButton: false
            });
        } else {
            let errorMsg = 'Error al subir archivo';
            const contentType = response.headers.get('content-type');
            
            try {
                if (contentType && contentType.includes('application/json')) {
                    const errorData = await response.json();
                    errorMsg = errorData.error || errorMsg;
                    console.error('❌ Error del servidor (JSON):', errorData);
                } else {
                    const errorText = await response.text();
                    console.error('❌ Error del servidor (Text):', errorText.substring(0, 500));
                    
                    if (errorText.includes('<!DOCTYPE') || errorText.includes('<html')) {
                        errorMsg = 'Error del servidor: el servidor devolvió HTML en lugar de JSON. Revisa los logs del servidor.';
                    } else {
                        errorMsg = errorText || errorMsg;
                    }
                }
            } catch (readError) {
                console.error('❌ Error leyendo respuesta:', readError);
                errorMsg = `Error de red: ${response.status} ${response.statusText}`;
            }
            
            throw new Error(errorMsg);
        }
    } catch (error) {
        console.error('❌ Error subiendo archivo:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'No se pudo subir el archivo',
            confirmButtonColor: '#D32F2F'
        });
    }
}

    async enviarArchivo() {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);
        
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const response = await fetch(`/api/chats/${this.chatActual.id_chat}/mensajes`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...sesionManager.getAuthHeaders()
                        },
                        body: JSON.stringify({
                            contenido: file.name,
                            tipo: 'archivo',
                            url_multimedia: `/uploads/${file.name}`
                        })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        this.agregarMensajeAUI(data.mensaje);
                        
                        Swal.fire({
                            icon: 'success',
                            title: 'Archivo enviado',
                            timer: 2000,
                            showConfirmButton: false
                        });
                    }
                } catch (error) {
                    console.error('Error enviando archivo:', error);
                }
            }
            document.body.removeChild(fileInput);
        });
        
        fileInput.click();
    }

    // async crearTarea() {
    //     const { value: formValues } = await Swal.fire({
    //         title: 'Crear nueva tarea',
    //         html:
    //             '<input id="swal-input1" class="swal2-input" placeholder="Título de la tarea">' +
    //             '<textarea id="swal-input2" class="swal2-textarea" placeholder="Descripción de la tarea"></textarea>',
    //         focusConfirm: false,
    //         showCancelButton: true,
    //         confirmButtonText: 'Crear tarea',
    //         confirmButtonColor: '#4CAF50',
    //         cancelButtonColor: '#D32F2F',
    //         preConfirm: () => ({
    //             titulo: document.getElementById('swal-input1').value,
    //             descripcion: document.getElementById('swal-input2').value
    //         })
    //     });

    //     if (formValues?.titulo) {
    //         await this.enviarTarea(formValues.titulo, formValues.descripcion);
    //     }
    // }

    // async enviarTarea(titulo, descripcion) {
    //     try {
    //         const response = await fetch(`/api/chats/${this.chatActual.id_chat}/mensajes`, {
    //             method: 'POST',
    //             headers: {
    //                 'Content-Type': 'application/json',
    //                 ...sesionManager.getAuthHeaders()
    //             },
    //             body: JSON.stringify({
    //                 contenido: JSON.stringify({ titulo, descripcion, tipo: 'tarea' }),
    //                 tipo: 'tarea'
    //             })
    //         });

    //         if (response.ok) {
    //             const data = await response.json();
    //             this.agregarMensajeAUI(data.mensaje);
                
    //             Swal.fire({
    //                 icon: 'success',
    //                 title: 'Tarea creada',
    //                 timer: 2000,
    //                 showConfirmButton: false
    //             });
    //         }
    //     } catch (error) {
    //         console.error('Error enviando tarea:', error);
    //     }
    // }

    // async enviarUbicacion() {
    //     const ubicacionURL = "https://www.google.com/maps?q=25.6866,-100.3161";
    //     const nombreUbicacion = "Ubicación compartida";
        
    //     try {
    //         const response = await fetch(`/api/chats/${this.chatActual.id_chat}/mensajes`, {
    //             method: 'POST',
    //             headers: {
    //                 'Content-Type': 'application/json',
    //                 ...sesionManager.getAuthHeaders()
    //             },
    //             body: JSON.stringify({
    //                 contenido: nombreUbicacion,
    //                 tipo: 'ubicacion',
    //                 url_multimedia: ubicacionURL
    //             })
    //         });

    //         if (response.ok) {
    //             const data = await response.json();
    //             this.agregarMensajeAUI(data.mensaje);
                
    //             Swal.fire({
    //                 icon: 'success',
    //                 title: 'Ubicación compartida',
    //                 timer: 2000,
    //                 showConfirmButton: false
    //             });
    //         }
    //     } catch (error) {
    //         console.error('Error enviando ubicación:', error);
    //     }
    // }

    async enviarUbicacion() {
        if (!this.chatActual) {
            Swal.fire({
                icon: 'warning',
                title: 'Selecciona un chat primero'
            });
            return;
        }

        // Verificar si el navegador soporta geolocalización
        if (!navigator.geolocation) {
            Swal.fire({
                icon: 'error',
                title: 'Geolocalización no soportada',
                text: 'Tu navegador no soporta geolocalización'
            });
            return;
        }

        Swal.fire({
            title: 'Obteniendo ubicación...',
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                const ubicacionURL = `https://www.google.com/maps?q=${lat},${lon}`;
                
                try {
                    const response = await fetch(`/api/chats/${this.chatActual.id_chat}/mensajes`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...sesionManager.getAuthHeaders()
                        },
                        body: JSON.stringify({
                            contenido: 'Ubicación compartida',
                            tipo: 'ubicacion',
                            url_multimedia: ubicacionURL
                        })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        this.agregarMensajeAUI(data.mensaje);
                        
                        Swal.fire({
                            icon: 'success',
                            title: 'Ubicación compartida',
                            timer: 2000,
                            showConfirmButton: false
                        });
                    }
                } catch (error) {
                    console.error('Error enviando ubicación:', error);
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'No se pudo compartir la ubicación'
                    });
                }
            },
            (error) => {
                console.error('Error obteniendo ubicación:', error);
                let mensaje = 'No se pudo obtener tu ubicación';
                
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        mensaje = 'Debes permitir el acceso a tu ubicación';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        mensaje = 'Ubicación no disponible';
                        break;
                    case error.TIMEOUT:
                        mensaje = 'Tiempo de espera agotado';
                        break;
                }
                
                Swal.fire({
                    icon: 'error',
                    title: 'Error de geolocalización',
                    text: mensaje
                });
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    }

    // CHATS GRUPALES
    async mostrarModalNuevoGrupo() {
        if (this.usuariosDisponibles.length === 0) {
            await this.cargarUsuariosDisponibles();
        }

        this.usuariosSeleccionadosGrupo = [];

        Swal.fire({
            title: 'Nuevo Grupo',
            html: `
                <div class="modal-grupo" style="max-height: 60vh; overflow-y: auto;">
                    <h3 style="margin-bottom: 15px; color: #333;">Crear nuevo grupo</h3>
                    
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Nombre del grupo:</label>
                        <input type="text" 
                               class="group-name-input" 
                               placeholder="Ej: Familia, Amigos..." 
                               id="group-name"
                               style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                    </div>
                    
                    <div class="search-container" style="margin-bottom: 15px; display: flex;">
                        <input type="text" 
                               class="search-input" 
                               placeholder="Buscar usuarios..." 
                               id="search-grupo"
                               style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 5px 0 0 5px;">
                        <button class="search-button" id="search-btn-grupo" 
                                style="padding: 8px 12px; background: #D32F2F; color: white; border: none; border-radius: 0 5px 5px 0; cursor: pointer;">
                            <i class="fas fa-search"></i>
                        </button>
                    </div>
                    
                    <div style="margin-bottom: 15px;">
                        <label style="font-weight: bold; display: block; margin-bottom: 8px;">
                            Seleccionar integrantes (mínimo 2):
                        </label>
                        <div class="usuarios-lista-grupo" id="user-list-group" 
                             style="border: 1px solid #eee; border-radius: 5px; max-height: 200px; overflow-y: auto; padding: 10px;">
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 15px; padding: 10px; background: #f5f5f5; border-radius: 5px;">
                        <p style="margin: 0; font-weight: bold;">
                            Usuarios seleccionados: <span id="selected-count" style="color: #D32F2F;">0</span>
                        </p>
                    </div>
                    
                    <button class="create-group-button" id="create-group-btn" 
                            style="width: 100%; padding: 12px; background: #cccccc; color: white; border: none; border-radius: 5px; cursor: not-allowed;"
                            disabled>
                        🚀 Crear grupo
                    </button>
                </div>
            `,
            showConfirmButton: false,
            showCloseButton: true,
            width: '500px',
            didOpen: () => {
                const searchInput = document.getElementById('search-grupo');
                const searchBtn = document.getElementById('search-btn-grupo');
                const userList = document.getElementById('user-list-group');
                const groupNameInput = document.getElementById('group-name');
                const createGroupBtn = document.getElementById('create-group-btn');

                this.buscarUsuariosParaGrupo('', userList);

                searchBtn.addEventListener('click', () => this.buscarUsuariosParaGrupo(searchInput.value, userList));
                searchInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') this.buscarUsuariosParaGrupo(searchInput.value, userList);
                });

                groupNameInput.addEventListener('input', () => {
                    this.validarFormularioGrupo(groupNameInput.value, createGroupBtn);
                });

                createGroupBtn.addEventListener('click', () => {
                    if (!createGroupBtn.disabled) {
                        this.crearGrupo(groupNameInput.value.trim());
                    }
                });
            }
        });
    }

    buscarUsuariosParaGrupo(query, userList) {
        userList.innerHTML = '';
        
        const resultados = this.usuariosDisponibles.filter(usuario => 
            usuario.nombre.toLowerCase().includes(query.toLowerCase())
        );
        
        if (resultados.length === 0) {
            userList.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No se encontraron usuarios</p>';
            return;
        }
        
        resultados.forEach(usuario => {
            const userItem = document.createElement('div');
            userItem.style.cssText = 'display: flex; align-items: center; padding: 10px; border-bottom: 1px solid #eee; cursor: pointer;';
            
            const avatar = usuario.foto ? 
                `<img src="../uploads/${usuario.foto}" alt="${usuario.nombre}" style="width: 40px; height: 40px; border-radius: 50%; margin-right: 10px;">` :
                `<div style="width: 40px; height: 40px; border-radius: 50%; background: #4CAF50; color: white; display: flex; align-items: center; justify-content: center; margin-right: 10px; font-weight: bold;">${usuario.nombre?.charAt(0) || 'U'}</div>`;
            
            const yaSeleccionado = this.usuariosSeleccionadosGrupo.includes(usuario.id);
            
            userItem.innerHTML = `
                ${avatar}
                <div style="flex: 1;">
                    <div style="font-weight: bold;">${usuario.nombre}</div>
                    <div style="color: #666; font-size: 12px;">@${usuario.nombreUsuario || usuario.nombre.toLowerCase()}</div>
                </div>
                ${usuario.online ? '<div style="width: 8px; height: 8px; background: #4CAF50; border-radius: 50%; margin-right: 10px;"></div>' : ''}
                <input type="checkbox" class="user-checkbox" data-id="${usuario.id}" ${yaSeleccionado ? 'checked' : ''} style="width: 18px; height: 18px;">
            `;
            
            const checkbox = userItem.querySelector('.user-checkbox');
            checkbox.addEventListener('change', (e) => {
                this.toggleUsuarioSeleccionadoGrupo(usuario.id, e.target.checked);
            });
            
            userItem.addEventListener('click', (e) => {
                if (e.target !== checkbox) {
                    checkbox.checked = !checkbox.checked;
                    this.toggleUsuarioSeleccionadoGrupo(usuario.id, checkbox.checked);
                }
            });
            
            userList.appendChild(userItem);
        });
    }

    toggleUsuarioSeleccionadoGrupo(usuarioId, seleccionado) {
        if (seleccionado) {
            if (!this.usuariosSeleccionadosGrupo.includes(usuarioId)) {
                this.usuariosSeleccionadosGrupo.push(usuarioId);
            }
        } else {
            this.usuariosSeleccionadosGrupo = this.usuariosSeleccionadosGrupo.filter(id => id !== usuarioId);
        }
        
        this.actualizarContadorSeleccionados();
        
        const groupNameInput = document.getElementById('group-name');
        const createGroupBtn = document.getElementById('create-group-btn');
        if (groupNameInput && createGroupBtn) {
            this.validarFormularioGrupo(groupNameInput.value, createGroupBtn);
        }
    }

    validarFormularioGrupo(nombre, boton) {
        const tieneNombre = nombre.trim().length > 0;
        const tieneUsuarios = this.usuariosSeleccionadosGrupo.length >= 2;
        
        boton.disabled = !(tieneNombre && tieneUsuarios);
        boton.style.background = boton.disabled ? '#cccccc' : '#D32F2F';
        boton.style.cursor = boton.disabled ? 'not-allowed' : 'pointer';
    }

    actualizarContadorSeleccionados() {
        const selectedCount = document.getElementById('selected-count');
        if (selectedCount) {
            selectedCount.textContent = this.usuariosSeleccionadosGrupo.length;
        }
    }

    async crearGrupo(nombre) {
        try {
            const response = await fetch('/api/chats/grupo', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...sesionManager.getAuthHeaders()
                },
                body: JSON.stringify({
                    nombre: nombre,
                    miembros: this.usuariosSeleccionadosGrupo
                })
            });

            if (response.ok) {
                Swal.close();
                await this.cargarChats();
                this.mostrarVistaChats();
                
                Swal.fire({
                    icon: 'success',
                    title: 'Grupo creado',
                    text: `El grupo "${nombre}" ha sido creado exitosamente`,
                    confirmButtonColor: '#4CAF50',
                    timer: 2000,
                    showConfirmButton: false
                });
            } else {
                const errorData = await response.json();
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: errorData.error || 'Error creando grupo',
                    confirmButtonColor: '#D32F2F'
                });
            }
        } catch (error) {
            console.error('❌ Error creando grupo:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Error de conexión',
                confirmButtonColor: '#D32F2F'
            });
        }
    }

    async mostrarIntegrantesGrupo(chatId) {
        try {
            const response = await fetch(`/api/chats/${chatId}/integrantes`, {
                headers: sesionManager.getAuthHeaders()
            });

            if (response.ok) {
                const data = await response.json();
                this.mostrarModalIntegrantes(data.integrantes, data.info_grupo);
            } else {
                const errorData = await response.json();
                this.mostrarError(errorData.error || 'Error cargando integrantes');
            }
        } catch (error) {
            console.error('❌ Error cargando integrantes:', error);
            this.mostrarError('Error de conexión al cargar integrantes');
        }
    }

    mostrarModalIntegrantes(integrantes, infoGrupo) {
        const titulo = infoGrupo ? `Integrantes de ${infoGrupo.nombre_grupo}` : 'Integrantes del grupo';
        const totalMiembros = infoGrupo ? ` (${infoGrupo.total_miembros} miembros)` : '';
        
        const integrantesHTML = integrantes.map(integrante => {
            const avatar = integrante.foto ? 
                `<img src="../uploads/${integrante.foto}" alt="${integrante.nombre}" style="width: 50px; height: 50px; border-radius: 50%;">` :
                `<div style="width: 50px; height: 50px; border-radius: 50%; background: #4CAF50; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px;">${integrante.nombre?.charAt(0) || 'U'}</div>`;
            
            return `
                <div style="display: flex; align-items: center; padding: 10px; border-bottom: 1px solid #eee;">
                    ${avatar}
                    <div style="margin-left: 15px; flex: 1;">
                        <div style="font-weight: bold;">${integrante.nombre}</div>
                        <div style="color: #666; font-size: 12px;">@${integrante.nombreUsuario || 'usuario'}</div>
                        <div style="font-size: 12px; margin-top: 2px;">
                            <span style="color: ${integrante.rol === 'admin' ? '#D32F2F' : '#666'}; font-weight: ${integrante.rol === 'admin' ? 'bold' : 'normal'};">
                                ${integrante.rol === 'admin' ? '👑 Administrador' : '👤 Miembro'}
                            </span>
                        </div>
                    </div>
                    <div style="color: ${integrante.online ? '#4CAF50' : '#666'}; font-size: 12px;">
                        ${integrante.online ? '🟢 En línea' : '⚫ Desconectado'}
                    </div>
                </div>
            `;
        }).join('');
        
        Swal.fire({
            title: `${titulo}${totalMiembros}`,
            html: `
                <div style="max-height: 400px; overflow-y: auto;">
                    ${integrantesHTML || '<p style="text-align: center; color: #666;">No hay integrantes</p>'}
                </div>
            `,
            confirmButtonText: 'Cerrar',
            confirmButtonColor: '#D32F2F',
            width: '500px'
        });
    }

    // CHATS PRIVADOS
    async mostrarModalNuevoChat() {
        if (this.usuariosDisponibles.length === 0) {
            await this.cargarUsuariosDisponibles();
        }

        if (this.usuariosDisponibles.length === 0) {
            Swal.fire({
                icon: 'info',
                title: 'Sin usuarios disponibles',
                text: 'No hay usuarios para chatear',
                confirmButtonColor: '#4CAF50'
            });
            return;
        }

        const usuariosHTML = this.usuariosDisponibles.map(usuario => {
            const avatar = usuario.foto ? 
                `<img src="../uploads/${usuario.foto}" alt="${usuario.nombre}" style="width: 50px; height: 50px; border-radius: 50%; margin-right: 15px;">` :
                `<div style="width: 50px; height: 50px; border-radius: 50%; background: #4CAF50; color: white; display: flex; align-items: center; justify-content: center; margin-right: 15px; font-weight: bold; font-size: 20px;">${usuario.nombre?.charAt(0) || 'U'}</div>`;
            
            return `
                <div class="usuario-item" data-user-id="${usuario.id}" style="display: flex; align-items: center; padding: 15px; border-bottom: 1px solid #eee; cursor: pointer; transition: background 0.2s;">
                    ${avatar}
                    <div style="flex: 1;">
                        <div style="font-weight: bold; font-size: 16px;">${usuario.nombre}</div>
                        <div style="color: #666; font-size: 14px;">@${usuario.nombreUsuario || usuario.nombre.toLowerCase()}</div>
                    </div>
                    ${usuario.online ? '<div style="width: 10px; height: 10px; background: #4CAF50; border-radius: 50%;"></div>' : ''}
                </div>
            `;
        }).join('');

        Swal.fire({
            title: 'Nuevo Chat',
            html: `
                <div style="max-height: 400px; overflow-y: auto;">
                    <h3 style="margin-bottom: 15px;">Selecciona un usuario para chatear</h3>
                    ${usuariosHTML}
                </div>
            `,
            showConfirmButton: false,
            showCloseButton: true,
            width: '500px',
            didOpen: () => {
                this.usuariosDisponibles.forEach(usuario => {
                    const elemento = document.querySelector(`[data-user-id="${usuario.id}"]`);
                    if (elemento) {
                        elemento.addEventListener('mouseenter', (e) => {
                            e.target.style.background = '#f5f5f5';
                        });
                        elemento.addEventListener('mouseleave', (e) => {
                            e.target.style.background = 'white';
                        });
                        elemento.addEventListener('click', () => this.crearChatPrivado(usuario));
                    }
                });
            }
        });
    }

    async crearChatPrivado(usuario) {
        try {
            const response = await fetch(`/api/chats/privado/${usuario.id}`, {
                method: 'POST',
                headers: sesionManager.getAuthHeaders()
            });

            if (response.ok) {
                Swal.close();
                await this.cargarChats();
                this.mostrarVistaChats();
                
                Swal.fire({
                    icon: 'success',
                    title: 'Chat creado',
                    text: `Ahora puedes chatear con ${usuario.nombre}`,
                    confirmButtonColor: '#4CAF50',
                    timer: 2000,
                    showConfirmButton: false
                });
            } else {
                const errorData = await response.json();
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: errorData.error || 'Error creando chat',
                    confirmButtonColor: '#D32F2F'
                });
            }
        } catch (error) {
            console.error('❌ Error creando chat:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Error de conexión',
                confirmButtonColor: '#D32F2F'
            });
        }
    }

    volverAContactos() {
        this.chatActual = null;
        this.mensajesActuales = [];
        document.querySelector('.chat-panel').classList.remove('active');
        document.querySelectorAll('.contact-item').forEach(item => item.classList.remove('active'));
    }

    mostrarError(mensaje) {
        console.error('❌ Error:', mensaje);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: mensaje,
            confirmButtonColor: '#D32F2F'
        });
    }

    async marcarTareaCompletada(tareaId, chatId) {
        try {
            const tareaElement = document.querySelector(`.task-message .task-check`);
            if (tareaElement) {
                tareaElement.innerHTML = '<i class="fas fa-check-circle" style="color: #4CAF50"></i>';
                tareaElement.disabled = true;
                tareaElement.closest('.task-message').classList.add('completada');
            }
            
            Swal.fire({
                icon: 'success',
                title: '¡Tarea completada!',
                timer: 1500,
                showConfirmButton: false
            });
        } catch (error) {
            console.error('Error marcando tarea:', error);
        }
    }
}

// Variable global
let chatManagerDB;

document.addEventListener('DOMContentLoaded', function() {
    if (typeof sesionManager === 'undefined') {
        console.error('❌ sesionManager no está disponible');
        return;
    }
    
    if (!sesionManager.isAuthenticated()) {
        window.location.href = '/login';
        return;
    }
    
    chatManagerDB = new ChatManagerDB();
});

const chatManager = new ChatManager();