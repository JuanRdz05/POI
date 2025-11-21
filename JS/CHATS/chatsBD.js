// chats.js - Sistema de Mensajería con Usuarios Reales y Grupos
class ChatManager {
    constructor() {
        this.contactos = [];
        this.chats = [];
        this.chatActual = null;
        this.usuariosDisponibles = [];
        this.usuariosSeleccionadosGrupo = [];
        this.socket = null;
        
        this.init();
    }

    async init() {
        await this.verificarAutenticacion();
        await this.conectarWebSocket();
        await this.cargarUsuariosDisponibles();
        this.cargarContactosLocales();
        this.configurarEventListeners();
        this.mostrarVistaContactos();
        this.mostrarDebugMensajes();
    }

    mostrarDebugMensajes() {
    console.log('=== DEBUG MENSAJES ===');
    console.log('Usuario actual:', sesionManager.user?.id, sesionManager.user?.nombre);
    
    this.contactos.forEach(contacto => {
        console.log(`Contacto: ${contacto.nombre} (ID: ${contacto.id})`);
        contacto.mensajes?.forEach((msg, index) => {
            console.log(`  Mensaje ${index}: "${msg.contenido}" - Enviado: ${msg.enviado} - RemitenteID: ${msg.remitenteId}`);
        });
    });
    console.log('======================');
    }

    async conectarWebSocket() {
        try{
            this.socket = io("http://localhost:3001");

            this.socket.on('connect', () =>
            {
                console.log("Conectado al servidor WebSocket");

                if(sesionManager.user && sesionManager.user.id)
                {
                    this.socket.emit('join-user', sesionManager.user.id);
                }
            });

            //Escuchar mensaje privados entrantes
            this.socket.on('receive-private-message', (data) =>{
                console.log("Mensaje recibido: ", data);
                this.manejarMensajeRecibido(data);
            });

            //Escuchar mensajes grupales entrantes
            this.socket.on('receive-group-message', (data)=>{
                console.log("Mnesaje grupal recibido: ", data);
                this.manejarMensajeGrupalRecibido(data);
            });

            //Confirmación de mensaje enviado
            this.socket.on('message-sent', (data)=>{
                console.log("Mensaje enviado: ", data);
                this.mostrarConfirmacionEnvio();
            });

            //Manejar errores
            this.socket.on('message-error', (error) =>{
                console.error("Error al enviar el mensaje: ", error);
                this.mostrarError("No se pudo enviar el mensaje");
            })

            this.socket.on('disconnect', ()=>{
                console.log("Desconectado del servidor");
            })
        }
        catch(error){
            console.error("Error al conectar al servidor WebSocket: ", error);
        }
    }
        
    async verificarAutenticacion() {
        if (!sesionManager || !sesionManager.isAuthenticated()) {
            window.location.href = '/login';
            return;
        }
    }

    async cargarUsuariosDisponibles() {
        try {
            console.log('🔄 Cargando usuarios disponibles...');
            
            const response = await fetch('http://localhost:3001/api/contactos/usuarios', {
                headers: sesionManager.getAuthHeaders()
            });

            if (response.ok) {
                const data = await response.json();
                this.usuariosDisponibles = data.usuarios || [];
                console.log(`✅ ${this.usuariosDisponibles.length} usuarios cargados`);
            } else {
                console.error('❌ Error cargando usuarios:', response.status);
                this.mostrarError('No se pudieron cargar los usuarios');
            }
        } catch (error) {
            console.error('❌ Error en cargarUsuariosDisponibles:', error);
            this.mostrarError('Error de conexión al cargar usuarios');
        }
    }

    cargarContactosLocales() {
    const userId = sesionManager.user?.id;
    if (!userId) return;
    
    const contactosGuardados = localStorage.getItem(`chats_contactos_${userId}`);
    const chatsGuardados = localStorage.getItem(`chats_chats_${userId}`);
    
    if (contactosGuardados) {
        this.contactos = JSON.parse(contactosGuardados);
    }
    
    if (chatsGuardados) {
        this.chats = JSON.parse(chatsGuardados);
    }
    }

    guardarContactosLocales() {
    // Agregar el ID del usuario actual para identificar de quién son los datos
    const userId = sesionManager.user?.id;
    if (!userId) return;
    
    localStorage.setItem(`chats_contactos_${userId}`, JSON.stringify(this.contactos));
    localStorage.setItem(`chats_chats_${userId}`, JSON.stringify(this.chats));
    }

    configurarEventListeners() {
        // Botones principales
        document.getElementById('new-chat').addEventListener('click', () => this.mostrarModalUsuarios());
        document.getElementById('new-group').addEventListener('click', () => this.mostrarModalNuevoGrupo());
        
        // Envío de mensajes
        document.querySelector('.send-button').addEventListener('click', () => this.enviarMensaje());
        document.querySelector('.message-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.enviarMensaje();
        });
        
        // Botón adjuntar
        document.querySelector('.attach-button').addEventListener('click', () => {
            if (this.chatActual) this.mostrarOpcionesAdjuntar();
        });
    }

    mostrarVistaContactos() {
        const contactsList = document.querySelector('.contacts-list');
        
        if (this.contactos.length === 0 && this.chats.length === 0) {
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
        
        // Mostrar contactos individuales
        this.contactos.forEach(contacto => {
            html += this.crearHTMLContacto(contacto);
        });
        
        // Mostrar chats grupales
        this.chats.forEach(chat => {
            html += this.crearHTMLChatGrupal(chat);
        });
        
        contactsList.innerHTML = html;
        
        // Agregar event listeners a los contactos
        this.contactos.forEach(contacto => {
            const elemento = document.querySelector(`[data-contacto-id="${contacto.id}"]`);
            if (elemento) {
                elemento.addEventListener('click', () => this.seleccionarContacto(contacto));
            }
        });
        
        // Agregar event listeners a los chats grupales
        this.chats.forEach(chat => {
            const elemento = document.querySelector(`[data-chat-id="${chat.id}"]`);
            if (elemento) {
                elemento.addEventListener('click', () => this.seleccionarChatGrupal(chat));
                
                // Evento para mostrar integrantes al hacer clic en el avatar
                const avatar = elemento.querySelector('.group-avatar');
                if (avatar) {
                    avatar.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.mostrarIntegrantesGrupo(chat.id);
                    });
                }
            }
        });
    }

    crearHTMLContacto(contacto) {
        const avatar = contacto.foto ? 
            `<img src="../uploads/${contacto.foto}" alt="${contacto.nombre}" class="contact-avatar-img">` :
            `<div class="contact-avatar-iniciales">${contacto.avatar}</div>`;
        
        return `
            <div class="contact-item" data-contacto-id="${contacto.id}">
                ${avatar}
                <div class="contact-info">
                    <div class="contact-name">${contacto.nombre}</div>
                    <div class="contact-lastmsg">${contacto.ultimoMensaje || 'Iniciar conversación'}</div>
                </div>
                ${contacto.online ? '<div class="online-indicator" title="En línea"></div>' : ''}
            </div>
        `;
    }

    crearHTMLChatGrupal(chat) {
        return `
            <div class="contact-item" data-chat-id="${chat.id}">
                <div class="contact-avatar-grupo group-avatar" data-chat-id="${chat.id}">
                    <i class="fas fa-users"></i>
                </div>
                <div class="contact-info">
                    <div class="contact-name">${chat.nombre}</div>
                    <div class="contact-lastmsg">${chat.ultimoMensaje || `${chat.miembros.length} miembros`}</div>
                </div>
            </div>
        `;
    }

    async mostrarModalUsuarios() {
        if (this.usuariosDisponibles.length === 0) {
            await this.cargarUsuariosDisponibles();
        }

        const usuariosFiltrados = this.usuariosDisponibles.filter(usuario => 
            !this.contactos.some(contacto => contacto.id === usuario.id)
        );

        if (usuariosFiltrados.length === 0) {
            Swal.fire({
                icon: 'info',
                title: 'Sin usuarios disponibles',
                text: 'No hay nuevos usuarios para agregar',
                confirmButtonColor: '#4CAF50'
            });
            return;
        }

        let html = `
            <div class="modal-usuarios">
                <h3>Selecciona un usuario para chatear</h3>
                <div class="usuarios-lista">
        `;

        usuariosFiltrados.forEach(usuario => {
            const avatar = usuario.foto ? 
                `<img src="../uploads/${usuario.foto}" alt="${usuario.nombre}" class="user-avatar-img">` :
                `<div class="user-avatar-iniciales">${usuario.avatar}</div>`;
            
            html += `
                <div class="usuario-item" data-user-id="${usuario.id}">
                    ${avatar}
                    <div class="usuario-info">
                        <div class="usuario-nombre">${usuario.nombre}</div>
                        <div class="usuario-username">@${usuario.nombreUsuario}</div>
                    </div>
                    ${usuario.online ? '<div class="online-indicator small"></div>' : ''}
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;

        Swal.fire({
            title: 'Nuevo Chat',
            html: html,
            showConfirmButton: false,
            showCloseButton: true,
            width: '500px'
        });

        // Agregar event listeners a los usuarios
        usuariosFiltrados.forEach(usuario => {
            const elemento = document.querySelector(`[data-user-id="${usuario.id}"]`);
            if (elemento) {
                elemento.addEventListener('click', () => this.agregarContacto(usuario));
            }
        });
    }

    agregarContacto(usuario) {
        // Verificar si ya es contacto
        if (this.contactos.some(c => c.id === usuario.id)) {
            Swal.fire({
                icon: 'warning',
                title: 'Contacto existente',
                text: 'Ya tienes este usuario en tus contactos',
                confirmButtonColor: '#D32F2F'
            });
            return;
        }

        const nuevoContacto = {
            id: usuario.id,
            nombre: usuario.nombre,
            avatar: usuario.avatar,
            foto: usuario.foto,
            online: usuario.online,
            mensajes: [],
            ultimoMensaje: null
        };

        this.contactos.push(nuevoContacto);
        this.guardarContactosLocales();
        this.mostrarVistaContactos();

        Swal.close();
        
        Swal.fire({
            icon: 'success',
            title: 'Contacto agregado',
            text: `Ahora puedes chatear con ${usuario.nombre}`,
            confirmButtonColor: '#4CAF50',
            timer: 2000
        });

        // Seleccionar automáticamente el nuevo contacto
        this.seleccionarContacto(nuevoContacto);
    }

    seleccionarContacto(contacto) {
        this.chatActual = { tipo: 'contacto', id: contacto.id };
        
        // Actualizar UI
        this.mostrarChatContacto(contacto);
        this.cargarMensajesContacto(contacto);
        
        // Marcar como activo
        document.querySelectorAll('.contact-item').forEach(item => item.classList.remove('active'));
        document.querySelector(`[data-contacto-id="${contacto.id}"]`).classList.add('active');
        
        // Mostrar panel de chat
        document.querySelector('.chat-panel').classList.add('active');
    }

    mostrarChatContacto(contacto) {
        const chatHeader = document.querySelector('.chat-header');
        const avatar = contacto.foto ? 
            `<img src="../uploads/${contacto.foto}" alt="${contacto.nombre}" class="chat-avatar-img">` :
            `<div class="chat-avatar-iniciales">${contacto.avatar}</div>`;
        
        chatHeader.innerHTML = `
            <div class="chat-header-content">
                <button class="back-button" title="Volver a contactos">
                    <i class="fas fa-arrow-left"></i>
                </button>
                ${avatar}
                <div class="chat-header-info">
                    <div class="chat-contact-name">${contacto.nombre}</div>
                    <div class="chat-contact-status">${contacto.online ? 'En línea' : 'Desconectado'}</div>
                </div>
            </div>
            <div class="chat-header-actions">
                <button class="chat-action-btn" title="Opciones">
                    <i class="fas fa-ellipsis-v"></i>
                </button>
                <button class="chat-action-btn" title="Llamar">
                    <i class="fas fa-phone"></i>
                </button>
                <button class="chat-action-btn" title="Videollamada">
                    <i class="fas fa-video"></i>
                </button>
            </div>
        `;

        // Configurar botón de regreso
        const backButton = chatHeader.querySelector('.back-button');
        backButton.addEventListener('click', () => this.volverAContactos());
    }

    cargarMensajesContacto(contacto) {
        const messagesContainer = document.querySelector('.messages-container');
        const mensajes = contacto.mensajes || [];
        
        if (mensajes.length === 0) {
            messagesContainer.innerHTML = `
                <div class="no-messages">
                    <p>No hay mensajes con ${contacto.nombre}</p>
                    <p>Envía un mensaje para comenzar la conversación</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        mensajes.forEach(mensaje => {
            html += this.crearHTMLMensaje(mensaje);
        });
        
        messagesContainer.innerHTML = html;
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    crearHTMLMensaje(mensaje) {
    const esMio = mensaje.enviado === true;
    const clase = esMio ? 'message sent' : 'message received';
    const estado = mensaje.pendiente ? ' pendiente' : ' entregado';
    
    let contenido = mensaje.contenido;
    
    if (mensaje.tipo === 'archivo') {
        contenido = `<i class="fas fa-file" style="margin-right: 8px;"></i>${mensaje.contenido}`;
    } else if (mensaje.tipo === 'ubicacion') {
        contenido = `<i class="fas fa-map-marker-alt" style="margin-right: 8px;"></i>
                    <a href="${mensaje.url}" target="_blank" class="ubicacion-link">${mensaje.contenido}</a>`;
    } else if (mensaje.tipo === 'tarea') {
        return this.crearHTMLMensajeTarea(mensaje);
    }
    
    return `
        <div class="${clase}${estado}">
            <div class="message-content">${contenido}</div>
            <div class="message-time">${this.formatearHora(mensaje.timestamp)}</div>
            ${esMio ? '<div class="message-status"></div>' : ''}
        </div>
    `;
    }

    crearHTMLMensajeTarea(mensaje) {
        const completada = mensaje.completada ? 'completada' : '';
        return `
            <div class="message task-message ${completada}">
                <div class="task-header">
                    <div class="task-title">${mensaje.titulo}</div>
                    <button class="task-check" onclick="chatManager.marcarTareaCompletada(${mensaje.id})">
                        <i class="far fa-check-circle"></i>
                    </button>
                </div>
                <div class="task-description">${mensaje.contenido}</div>
                <div class="message-time">${this.formatearHora(mensaje.timestamp)}</div>
            </div>
        `;
    }

    formatearHora(timestamp) {
        return new Date(timestamp).toLocaleTimeString('es-MX', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    enviarMensaje() {
    const input = document.querySelector('.message-input');
    const texto = input.value.trim();
    
    if (!texto || !this.chatActual || !this.socket) return;
    
    const mensaje = {
        id: Date.now(),
        contenido: texto,
        timestamp: Date.now(),
        enviado: true, // ← ESTE es true porque YO lo envío
        remitenteId: sesionManager.user.id // ← Agregar mi ID
    };

    // Mostrar mensaje en el chat (optimistic update)
    this.agregarMensajeAUI(mensaje);
    input.value = '';
    
    if (this.chatActual.tipo === 'contacto') {
        // Enviar mensaje privado via WebSocket
        this.socket.emit('send-private-message', {
            fromUserId: sesionManager.user.id,
            toUserId: this.chatActual.id,
            message: texto,
            timestamp: mensaje.timestamp // ← CORREGIDO: usar mensaje.timestamp
        });
        
        // Actualizar localmente
        const contacto = this.contactos.find(c => c.id === this.chatActual.id);
        if (!contacto.mensajes) contacto.mensajes = [];
        contacto.mensajes.push(mensaje);
        contacto.ultimoMensaje = texto;
        
    } else {
        // Enviar mensaje grupal via WebSocket
        this.socket.emit('send-group-message', {
            chatId: this.chatActual.id,
            fromUserId: sesionManager.user.id,
            message: texto,
            timestamp: mensaje.timestamp // ← CORREGIDO
        });
        
        // Unirse al chat grupal si no está unido
        this.socket.emit('join-group', this.chatActual.id);
        
        // Actualizar localmente
        const chat = this.chats.find(c => c.id === this.chatActual.id);
        if (!chat.mensajes) chat.mensajes = [];
        chat.mensajes.push(mensaje);
        chat.ultimoMensaje = texto;
    }
    
    this.guardarContactosLocales();
    this.mostrarVistaContactos();
}

    //Manejar mensaje recibidos
    manejarMensajeRecibido(data) {
    const { fromUserId, message, timestamp } = data;
    
    console.log(`📩 Mensaje recibido de ${fromUserId}: ${message}`);
    
    // Buscar si ya tenemos este contacto
    let contacto = this.contactos.find(c => c.id === fromUserId);
    
    if (!contacto) {
        // Si es un nuevo contacto, buscar en usuarios disponibles
        const usuario = this.usuariosDisponibles.find(u => u.id === fromUserId);
        if (usuario) {
            contacto = {
                id: usuario.id,
                nombre: usuario.nombre,
                avatar: usuario.avatar,
                foto: usuario.foto,
                online: true,
                mensajes: [],
                ultimoMensaje: null
            };
            this.contactos.push(contacto);
        } else {
            console.warn('❌ Usuario desconocido envió mensaje:', fromUserId);
            return;
        }
    }
    
    // Crear mensaje recibido - IMPORTANTE: enviado: false
    const mensajeRecibido = {
        id: data.messageId || Date.now(),
        contenido: message,
        timestamp: timestamp,
        enviado: false, // ← ESTE ES EL CAMBIO CLAVE: false indica que NO lo envié yo
        remitenteId: fromUserId // ← Agregar ID del remitente
    };
    
    // Agregar mensaje al contacto
    if (!contacto.mensajes) contacto.mensajes = [];
    contacto.mensajes.push(mensajeRecibido);
    contacto.ultimoMensaje = message;
    contacto.online = true;
    
    // Si estamos en el chat con este contacto, mostrar el mensaje
    if (this.chatActual && this.chatActual.tipo === 'contacto' && this.chatActual.id === fromUserId) {
        this.agregarMensajeAUI(mensajeRecibido);
    }
    
    // Actualizar la lista de contactos
    this.mostrarVistaContactos();
    this.guardarContactosLocales();
    
    // Mostrar notificación si no estamos en el chat
    if (!this.chatActual || this.chatActual.id !== fromUserId) {
        this.mostrarNotificacion(contacto.nombre, message);
    }
}

    //Manejar mensaje grupales recibidos
    manejarMensajeGrupalRecibido(data) {
        const { chatId, fromUserId, message, timestamp } = data;
        
        const chat = this.chats.find(c => c.id === chatId);
        if (!chat) {
            console.warn('❌ Chat grupal desconocido:', chatId);
            return;
        }
        
        // No mostrar mensajes propios (ya los mostramos con optimistic update)
        if (fromUserId === sesionManager.user.id) return;
        
        const mensajeRecibido = {
            id: data.messageId || Date.now(),
            contenido: message,
            timestamp: timestamp,
            enviado: false,
            fromUserId: fromUserId
        };
        
        // Agregar mensaje al chat
        if (!chat.mensajes) chat.mensajes = [];
        chat.mensajes.push(mensajeRecibido);
        chat.ultimoMensaje = message;
        
        // Si estamos en este chat grupal, mostrar el mensaje
        if (this.chatActual && this.chatActual.tipo === 'chat' && this.chatActual.id === chatId) {
            this.agregarMensajeAUI(mensajeRecibido);
        }
        
        this.mostrarVistaContactos();
        this.guardarContactosLocales();
        
        // Mostrar notificación si no estamos en el chat
        if (!this.chatActual || this.chatActual.id !== chatId) {
            this.mostrarNotificacion(chat.nombre, message);
        }
    }

    //Mostrar notificaciones
    mostrarNotificacion(remitente, mensaje) {
        // Verificar si el navegador soporta notificaciones
        if (!("Notification" in window)) {
            console.log("Este navegador no soporta notificaciones");
            return;
        }
        
        // Verificar si ya tenemos permiso
        if (Notification.permission === "granted") {
            this.crearNotificacion(remitente, mensaje);
        } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                    this.crearNotificacion(remitente, mensaje);
                }
            });
        }
    }

    //Mostrar confirmación de envio para actualizar UI
    mostrarConfirmacionEnvio() {

        const ultimoMensaje = document.querySelector('.message.sent:last-child');
        if (ultimoMensaje) {
            ultimoMensaje.classList.remove('pendiente');
            ultimoMensaje.classList.add('entregado');
        }
    }

    crearNotificacion(remitente, mensaje) {
        const notification = new Notification(`Nuevo mensaje de ${remitente}`, {
            body: mensaje.length > 50 ? mensaje.substring(0, 50) + '...' : mensaje,
            icon: '../IMAGENES/logo.png'
        });
        
        notification.onclick = () => {
            window.focus();
            notification.close();
        };
        
        setTimeout(() => notification.close(), 5000);
    }


    agregarMensajeAUI(mensaje) {
        const messagesContainer = document.querySelector('.messages-container');
        const mensajeElement = this.crearHTMLMensaje(mensaje);
        
        // Remover el mensaje de "no hay mensajes" si existe
        if (messagesContainer.querySelector('.no-messages')) {
            messagesContainer.innerHTML = '';
        }
        
        messagesContainer.innerHTML += mensajeElement;
        
        // Scroll al final
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // FUNCIONALIDAD DE GRUPOS
    async mostrarModalNuevoGrupo() {
        if (this.usuariosDisponibles.length === 0) {
            await this.cargarUsuariosDisponibles();
        }

        this.usuariosSeleccionadosGrupo = [];

        let html = `
            <div class="modal-grupo">
                <h3>Crear nuevo grupo</h3>
                <div class="search-container">
                    <input type="text" class="search-input" placeholder="Buscar usuarios..." id="search-grupo">
                    <button class="search-button" id="search-btn-grupo"><i class="fas fa-search"></i></button>
                </div>
                <div class="usuarios-lista-grupo" id="user-list-group"></div>
                <div class="grupo-config">
                    <input type="text" class="group-name-input" placeholder="Nombre del grupo" id="group-name">
                    <button class="create-group-button" id="create-group-btn" disabled>Crear grupo</button>
                </div>
                <div class="selected-users" id="selected-users">
                    <p>Seleccionados: <span id="selected-count">0</span> usuarios</p>
                </div>
            </div>
        `;

        Swal.fire({
            title: 'Nuevo Grupo',
            html: html,
            showConfirmButton: false,
            showCloseButton: true,
            width: '500px',
            didOpen: () => {
                // Configurar eventos
                const searchInput = document.getElementById('search-grupo');
                const searchBtn = document.getElementById('search-btn-grupo');
                const userList = document.getElementById('user-list-group');
                const groupNameInput = document.getElementById('group-name');
                const createGroupBtn = document.getElementById('create-group-btn');

                searchBtn.addEventListener('click', () => this.buscarUsuariosParaGrupo(searchInput.value, userList));
                searchInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') this.buscarUsuariosParaGrupo(searchInput.value, userList);
                });

                groupNameInput.addEventListener('input', () => {
                    createGroupBtn.disabled = !groupNameInput.value.trim() || this.usuariosSeleccionadosGrupo.length < 2;
                });

                createGroupBtn.addEventListener('click', () => this.crearGrupo(groupNameInput.value));

                // Cargar usuarios inicialmente
                this.buscarUsuariosParaGrupo('', userList);
            }
        });
    }

    buscarUsuariosParaGrupo(query, userList) {
        userList.innerHTML = '';
        
        const resultados = this.usuariosDisponibles.filter(usuario => 
            usuario.nombre.toLowerCase().includes(query.toLowerCase())
        );
        
        if (resultados.length === 0) {
            userList.innerHTML = '<p class="no-results">No se encontraron usuarios</p>';
            return;
        }
        
        resultados.forEach(usuario => {
            const userItem = document.createElement('div');
            userItem.className = 'user-item grupo';
            
            const avatar = usuario.foto ? 
                `<img src="../uploads/${usuario.foto}" alt="${usuario.nombre}" class="user-avatar-img">` :
                `<div class="user-avatar-iniciales">${usuario.avatar}</div>`;
            
            const yaSeleccionado = this.usuariosSeleccionadosGrupo.includes(usuario.id);
            
            userItem.innerHTML = `
                ${avatar}
                <div class="usuario-info">
                    <div class="usuario-nombre">${usuario.nombre}</div>
                    <div class="usuario-username">@${usuario.nombreUsuario}</div>
                </div>
                ${usuario.online ? '<div class="online-indicator small"></div>' : ''}
                <input type="checkbox" class="user-checkbox" data-id="${usuario.id}" ${yaSeleccionado ? 'checked' : ''}>
            `;
            
            const checkbox = userItem.querySelector('.user-checkbox');
            checkbox.addEventListener('change', (e) => {
                this.toggleUsuarioSeleccionadoGrupo(usuario.id, e.target.checked);
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
        this.actualizarBotonCrearGrupo();
    }

    actualizarContadorSeleccionados() {
        const selectedCount = document.getElementById('selected-count');
        if (selectedCount) {
            selectedCount.textContent = this.usuariosSeleccionadosGrupo.length;
        }
    }

    actualizarBotonCrearGrupo() {
        const createGroupBtn = document.getElementById('create-group-btn');
        const groupNameInput = document.getElementById('group-name');
        
        if (createGroupBtn && groupNameInput) {
            createGroupBtn.disabled = !groupNameInput.value.trim() || this.usuariosSeleccionadosGrupo.length < 2;
        }
    }

    crearGrupo(nombre) {
        if (this.usuariosSeleccionadosGrupo.length < 2) {
            Swal.fire({
                icon: 'warning',
                title: 'Muy pocos miembros',
                text: 'Debes seleccionar al menos 2 usuarios para crear un grupo',
                confirmButtonColor: '#D32F2F'
            });
            return;
        }
        
        if (!nombre.trim()) {
            Swal.fire({
                icon: 'warning',
                title: 'Nombre requerido',
                text: 'Debes ingresar un nombre para el grupo',
                confirmButtonColor: '#D32F2F'
            });
            return;
        }
        
        // Verificar si ya existe un grupo con los mismos miembros
        const miembrosOrdenados = [...this.usuariosSeleccionadosGrupo].sort();
        const grupoExistente = this.chats.find(chat => {
            const chatMiembrosOrdenados = [...chat.miembros].sort();
            return JSON.stringify(chatMiembrosOrdenados) === JSON.stringify(miembrosOrdenados);
        });
        
        if (grupoExistente) {
            Swal.fire({
                icon: 'warning',
                title: 'Grupo existente',
                text: 'Ya tienes un grupo con estos mismos miembros',
                confirmButtonColor: '#D32F2F'
            });
            return;
        }
        
        // Crear nuevo grupo
        const nuevoGrupo = {
            id: Date.now(),
            nombre: nombre,
            miembros: this.usuariosSeleccionadosGrupo,
            mensajes: [],
            ultimoMensaje: null
        };
        
        this.chats.push(nuevoGrupo);
        this.guardarContactosLocales();
        this.mostrarVistaContactos();
        
        Swal.close();
        
        Swal.fire({
            icon: 'success',
            title: 'Grupo creado',
            text: `El grupo "${nombre}" ha sido creado exitosamente`,
            confirmButtonColor: '#4CAF50'
        });

        // Seleccionar automáticamente el nuevo grupo
        this.seleccionarChatGrupal(nuevoGrupo);
    }

    seleccionarChatGrupal(chat) {
        this.chatActual = { tipo: 'chat', id: chat.id };
        
        //Unirse a la sala del chat grupal
        if(this.socket)
        {
            this.socket.emit('join-group', chat.id);
        }

        // Actualizar UI
        this.mostrarChatGrupal(chat);
        this.cargarMensajesChatGrupal(chat);
        
        // Marcar como activo
        document.querySelectorAll('.contact-item').forEach(item => item.classList.remove('active'));
        document.querySelector(`[data-chat-id="${chat.id}"]`).classList.add('active');
        
        // Mostrar panel de chat
        document.querySelector('.chat-panel').classList.add('active');
        this.mostrarChatGrupal(chat);
        this.cargarMensajesChatGrupal(chat);
        document.querySelector('.chat-panel').classList.add('active');
        
    }

    mostrarChatGrupal(chat) {
        const chatHeader = document.querySelector('.chat-header');
        
        chatHeader.innerHTML = `
            <div class="chat-header-content">
                <button class="back-button" title="Volver a contactos">
                    <i class="fas fa-arrow-left"></i>
                </button>
                <div class="contact-avatar-grupo group-avatar-header" data-chat-id="${chat.id}">
                    <i class="fas fa-users"></i>
                </div>
                <div class="chat-header-info">
                    <div class="chat-contact-name">${chat.nombre}</div>
                    <div class="chat-contact-status">${chat.miembros.length} miembros</div>
                </div>
            </div>
            <div class="chat-header-actions">
                <button class="chat-action-btn" title="Ver integrantes">
                    <i class="fas fa-info-circle"></i>
                </button>
            </div>
        `;

        // Configurar botón de regreso
        const backButton = chatHeader.querySelector('.back-button');
        backButton.addEventListener('click', () => this.volverAContactos());

        // Configurar botón de integrantes
        const infoButton = chatHeader.querySelector('.chat-action-btn');
        infoButton.addEventListener('click', () => this.mostrarIntegrantesGrupo(chat.id));
    }

    cargarMensajesChatGrupal(chat) {
        const messagesContainer = document.querySelector('.messages-container');
        const mensajes = chat.mensajes || [];
        
        if (mensajes.length === 0) {
            messagesContainer.innerHTML = `
                <div class="no-messages">
                    <p>No hay mensajes en el grupo</p>
                    <p>Envía un mensaje para comenzar la conversación</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        mensajes.forEach(mensaje => {
            html += this.crearHTMLMensaje(mensaje);
        });
        
        messagesContainer.innerHTML = html;
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    mostrarIntegrantesGrupo(chatId) {
        const chat = this.chats.find(c => c.id === chatId);
        if (!chat) return;
        
        // Obtener información de los miembros
        const miembrosInfo = chat.miembros.map(miembroId => {
            const usuario = this.usuariosDisponibles.find(u => u.id === miembroId);
            return usuario ? usuario : { id: miembroId, nombre: 'Usuario desconocido', avatar: '??' };
        });
        
        // Crear HTML para la lista de miembros
        const miembrosHTML = miembrosInfo.map(miembro => {
            const avatar = miembro.foto ? 
                `<img src="../uploads/${miembro.foto}" alt="${miembro.nombre}" class="user-avatar-img">` :
                `<div class="user-avatar-iniciales">${miembro.avatar}</div>`;
            
            return `
                <div class="miembro-item">
                    ${avatar}
                    <div class="user-name">${miembro.nombre}</div>
                    <div class="user-status">${miembro.online ? '🟢 En línea' : '⚫ Desconectado'}</div>
                </div>
            `;
        }).join('');
        
        Swal.fire({
            title: `Integrantes de ${chat.nombre}`,
            html: `
                <div class="integrantes-container">
                    <div class="integrantes-list">
                        ${miembrosHTML}
                    </div>
                </div>
            `,
            showConfirmButton: true,
            confirmButtonText: 'Cerrar',
            confirmButtonColor: '#4CAF50',
            width: '400px'
        });
    }

    volverAContactos() {
        this.chatActual = null;
        document.querySelector('.chat-panel').classList.remove('active');
        document.querySelectorAll('.contact-item').forEach(item => item.classList.remove('active'));
    }

    // OPCIONES ADJUNTAR (igual que antes)
    mostrarOpcionesAdjuntar() {
        Swal.fire({
            title: '¿Qué deseas adjuntar?',
            showDenyButton: true,
            showCancelButton: true,
            showCloseButton: true,
            confirmButtonText: 'Archivo',
            denyButtonText: 'Tarea',
            cancelButtonText: 'Ubicación',
            confirmButtonColor: '#4CAF50',
            denyButtonColor: '#2196F3',
            cancelButtonColor: '#FF9800'
        }).then((result) => {
            if (result.isConfirmed) {
                this.enviarArchivo();
            } else if (result.isDenied) {
                this.crearTarea();
            } else if (result.dismiss === Swal.DismissReason.cancel) {
                this.enviarUbicacion();
            }
        });
    }

    enviarArchivo() {
        // Simular envío de archivo
        const nombreArchivo = 'documento.pdf';
        const mensaje = {
            id: Date.now(),
            contenido: nombreArchivo,
            timestamp: Date.now(),
            enviado: true,
            tipo: 'archivo'
        };
        
        this.enviarMensajeEspecial(mensaje, `Archivo: ${nombreArchivo}`);
    }

    crearTarea() {
        Swal.fire({
            title: 'Crear nueva tarea',
            html: `
                <input id="swal-input1" class="swal2-input" placeholder="Título de la tarea">
                <textarea id="swal-input2" class="swal2-textarea" placeholder="Descripción de la tarea"></textarea>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Crear tarea',
            confirmButtonColor: '#4CAF50',
            cancelButtonColor: '#D32F2F',
            preConfirm: () => {
                return {
                    titulo: document.getElementById('swal-input1').value,
                    descripcion: document.getElementById('swal-input2').value
                };
            }
        }).then((result) => {
            if (result.isConfirmed && result.value.titulo) {
                this.enviarTarea(result.value.titulo, result.value.descripcion);
            }
        });
    }

    enviarTarea(titulo, descripcion) {
        const tarea = {
            id: Date.now(),
            tipo: 'tarea',
            titulo: titulo,
            contenido: descripcion || 'Sin descripción',
            timestamp: Date.now(),
            enviado: true,
            completada: false
        };
        
        this.enviarMensajeEspecial(tarea, `Tarea: ${titulo}`);
    }

    enviarUbicacion() {
        const ubicacionURL = "https://www.google.com/maps?q=25.6866,-100.3161";
        const nombreUbicacion = "Ubicación compartida";
        
        const mensaje = {
            id: Date.now(),
            contenido: nombreUbicacion,
            url: ubicacionURL,
            timestamp: Date.now(),
            enviado: true,
            tipo: 'ubicacion'
        };
        
        this.enviarMensajeEspecial(mensaje, `📍 ${nombreUbicacion}`);
    }

    enviarMensajeEspecial(mensaje, textoUltimoMensaje) {
        if (!this.chatActual) return;
        
        // Agregar mensaje al chat actual
        if (this.chatActual.tipo === 'contacto') {
            const contacto = this.contactos.find(c => c.id === this.chatActual.id);
            if (!contacto.mensajes) contacto.mensajes = [];
            contacto.mensajes.push(mensaje);
            contacto.ultimoMensaje = textoUltimoMensaje;
        } else {
            const chat = this.chats.find(c => c.id === this.chatActual.id);
            if (!chat.mensajes) chat.mensajes = [];
            chat.mensajes.push(mensaje);
            chat.ultimoMensaje = textoUltimoMensaje;
        }
        
        // Actualizar UI
        this.agregarMensajeAUI(mensaje);
        
        // Guardar y actualizar lista
        this.guardarContactosLocales();
        this.mostrarVistaContactos();
        
        Swal.fire({
            icon: 'success',
            title: 'Enviado',
            text: 'Tu mensaje ha sido enviado',
            confirmButtonColor: '#4CAF50',
            timer: 1500
        });
    }

    marcarTareaCompletada(tareaId) {
        if (!this.chatActual) return;
        
        let mensajes;
        if (this.chatActual.tipo === 'contacto') {
            const contacto = this.contactos.find(c => c.id === this.chatActual.id);
            mensajes = contacto.mensajes;
        } else {
            const chat = this.chats.find(c => c.id === this.chatActual.id);
            mensajes = chat.mensajes;
        }
        
        const tarea = mensajes.find(m => m.id === tareaId && m.tipo === 'tarea');
        if (tarea) {
            tarea.completada = true;
            
            // Actualizar UI
            const tareaElement = document.querySelector(`.task-message .task-check`);
            if (tareaElement) {
                tareaElement.innerHTML = '<i class="fas fa-check-circle" style="color: #4CAF50"></i>';
                tareaElement.disabled = true;
                tareaElement.closest('.task-message').classList.add('completada');
            }
            
            // Guardar cambios
            this.guardarContactosLocales();
            
            Swal.fire({
                icon: 'success',
                title: '¡Tarea completada!',
                text: 'Has marcado esta tarea como completada',
                confirmButtonColor: '#4CAF50',
                timer: 1500
            });
        }
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
}

// Hacer chatManager global para las funciones de los botones
let chatManager;

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    // Verificar que sesionManager esté disponible
    if (typeof sesionManager === 'undefined') {
        console.error('❌ sesionManager no está disponible');
        return;
    }
    
    if (!sesionManager.isAuthenticated()) {
        window.location.href = '/login';
        return;
    }
    
    // Inicializar el sistema de chats
    chatManager = new ChatManager();
});