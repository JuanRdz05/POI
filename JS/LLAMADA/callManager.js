// JS/LLAMADA/callManager.js - Sistema de Llamadas WebRTC (CORREGIDO)
class CallManager {
    constructor() {
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.callId = null;
        this.remoteUserId = null;
        this.socket = null;
        this.isInitiator = false;
        this.tipoLlamada = 'audio';
        this.camaraActiva = false; // 🔥 NUEVO: Estado de la cámara
        
        // Configuración de servidores STUN/TURN
        this.configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
        
        this.init();
    }

    async init() {
        if (!sesionManager || !sesionManager.isAuthenticated()) {
            window.location.href = '/login';
            return;
        }

        const callData = JSON.parse(localStorage.getItem('currentCall') || '{}');
        
        if (!callData.callId || !callData.remoteUser) {
            console.error('❌ No hay datos de llamada');
            window.location.href = '/chats';
            return;
        }

        this.callId = callData.callId;
        this.remoteUserId = callData.remoteUser.id;
        this.isInitiator = callData.isInitiator || false;

        this.actualizarUIUsuario(callData.remoteUser);
        await this.conectarWebSocket();
        await this.iniciarLlamada();
        this.configurarControles();
    }

    async conectarWebSocket() {
        try {
            this.socket = io("/");

            this.socket.on('connect', () => {
                console.log("✅ Conectado al servidor WebSocket");
                if (sesionManager.user && sesionManager.user.id) {
                    this.socket.emit('join-user', sesionManager.user.id);
                }
            });

            // 📞 RECIBIR OFERTA WebRTC
            this.socket.on('webrtc-offer', async (data) => {
                console.log("📞 Oferta WebRTC recibida", data);
                if (data.callId == this.callId) {
                    await this.manejarOferta(data.offer, data.fromUserId);
                }
            });

            // ✅ RECIBIR RESPUESTA WebRTC
            this.socket.on('webrtc-answer', async (data) => {
                console.log("✅ Respuesta WebRTC recibida", data);
                if (data.callId == this.callId) {
                    await this.manejarRespuesta(data.answer);
                }
            });

            // 🧊 RECIBIR ICE CANDIDATE
            this.socket.on('webrtc-ice-candidate', async (data) => {
                console.log("🧊 ICE Candidate recibido", data);
                if (data.callId == this.callId && data.candidate) {
                    await this.agregarIceCandidate(data.candidate);
                }
            });

            // 🔥 NUEVO: Recibir notificación de que el otro usuario activó/desactivó cámara
            this.socket.on('camera-state-changed', (data) => {
                console.log("📹 Estado de cámara del otro usuario cambió:", data);
                if (data.callId == this.callId) {
                    this.actualizarIconoCamaraRemota(data.cameraEnabled);
                }
            });

            // 📴 LLAMADA FINALIZADA
            this.socket.on('call-ended', (data) => {
                console.log("📴 Llamada finalizada por el otro usuario");
                this.finalizarLlamada(false);
            });

            // ❌ LLAMADA RECHAZADA
            this.socket.on('call-rejected', (data) => {
                console.log("❌ Llamada rechazada");
                Swal.fire({
                    icon: 'error',
                    title: 'Llamada rechazada',
                    text: 'El usuario rechazó la llamada',
                    confirmButtonColor: '#D32F2F'
                }).then(() => {
                    window.location.href = '/chats';
                });
            });

        } catch (error) {
            console.error("❌ Error conectando WebSocket:", error);
        }
    }

    async iniciarLlamada() {
        try {
            // Solicitar acceso al micrófono
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false
            });

            console.log("✅ Micrófono activado");

            // Crear conexión peer
            await this.crearPeerConnection();

            // Agregar stream local
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });

            // Si somos el iniciador, crear oferta
            if (this.isInitiator) {
                await this.crearOferta();
            }

            this.actualizarEstadoLlamada('Conectado');

        } catch (error) {
            console.error("❌ Error iniciando llamada:", error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudo acceder al micrófono',
                confirmButtonColor: '#D32F2F'
            }).then(() => {
                window.location.href = '/chats';
            });
        }
    }

    async crearPeerConnection() {
        this.peerConnection = new RTCPeerConnection(this.configuration);

        // 🔥 IMPORTANTE: Manejar negotiation cuando se agregan/quitan tracks
        this.peerConnection.onnegotiationneeded = async () => {
            console.log("🔄 Renegociación necesaria");
            try {
                if (this.isInitiator || this.peerConnection.signalingState !== 'stable') {
                    const offer = await this.peerConnection.createOffer();
                    await this.peerConnection.setLocalDescription(offer);

                    this.socket.emit('webrtc-offer', {
                        callId: this.callId,
                        toUserId: this.remoteUserId,
                        offer: offer
                    });
                    
                    console.log("📤 Nueva oferta enviada por renegociación");
                }
            } catch (error) {
                console.error("❌ Error en renegociación:", error);
            }
        };

        // Manejar ICE candidates
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log("🧊 Enviando ICE candidate");
                this.socket.emit('webrtc-ice-candidate', {
                    callId: this.callId,
                    toUserId: this.remoteUserId,
                    candidate: event.candidate
                });
            }
        };

        // Manejar stream remoto
        this.peerConnection.ontrack = (event) => {
            console.log("🎵 Track remoto recibido:", event.track.kind);
            
            if (!this.remoteStream) {
                this.remoteStream = new MediaStream();
            }
            
            // 🔥 Agregar el track al stream remoto
            this.remoteStream.addTrack(event.track);
            
            if (event.track.kind === 'audio') {
                // Reproducir audio remoto
                const audioElement = document.getElementById('remoteAudio') || document.createElement('audio');
                audioElement.id = 'remoteAudio';
                audioElement.autoplay = true;
                audioElement.srcObject = this.remoteStream;
                
                if (!document.getElementById('remoteAudio')) {
                    document.body.appendChild(audioElement);
                }
                
                console.log("🔊 Audio remoto configurado");
            } else if (event.track.kind === 'video') {
                // Mostrar video remoto
                console.log("📹 Video remoto recibido, mostrando...");
                this.mostrarVideoRemoto();
            }

            // 🔥 Detectar cuando el track remoto termina
            event.track.onended = () => {
                console.log(`❌ Track ${event.track.kind} remoto terminó`);
                if (event.track.kind === 'video') {
                    this.ocultarVideoRemoto();
                }
            };
        };

        // Manejar cambios de estado de conexión
        this.peerConnection.onconnectionstatechange = () => {
            console.log("🔄 Estado de conexión:", this.peerConnection.connectionState);
            
            if (this.peerConnection.connectionState === 'connected') {
                this.actualizarEstadoLlamada('En llamada');
            } else if (this.peerConnection.connectionState === 'disconnected') {
                this.finalizarLlamada(false);
            } else if (this.peerConnection.connectionState === 'failed') {
                this.finalizarLlamada(false);
            }
        };
    }

    async crearOferta() {
        try {
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);

            console.log("📞 Enviando oferta WebRTC");
            this.socket.emit('webrtc-offer', {
                callId: this.callId,
                toUserId: this.remoteUserId,
                offer: offer
            });

        } catch (error) {
            console.error("❌ Error creando oferta:", error);
        }
    }

    async manejarOferta(offer, fromUserId) {
        try {
            // 🔥 Verificar el estado de señalización antes de establecer la descripción remota
            if (this.peerConnection.signalingState !== 'stable') {
                console.log("⚠️ Estado no estable, esperando...");
                await this.peerConnection.setLocalDescription({ type: 'rollback' });
            }

            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);

            console.log("✅ Enviando respuesta WebRTC");
            this.socket.emit('webrtc-answer', {
                callId: this.callId,
                toUserId: fromUserId,
                answer: answer
            });

        } catch (error) {
            console.error("❌ Error manejando oferta:", error);
        }
    }

    async manejarRespuesta(answer) {
        try {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            console.log("✅ Respuesta WebRTC establecida");
        } catch (error) {
            console.error("❌ Error manejando respuesta:", error);
        }
    }

    async agregarIceCandidate(candidate) {
        try {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            console.log("✅ ICE candidate agregado");
        } catch (error) {
            console.error("❌ Error agregando ICE candidate:", error);
        }
    }

    configurarControles() {
        const micBtn = document.getElementById('micBtn');
        const camaraBtn = document.getElementById('camaraBtn');
        const colgarBtn = document.getElementById('colgarBtn');
        
        let microfonoActivo = true;

        // Botón de micrófono
        micBtn.addEventListener('click', () => {
            microfonoActivo = !microfonoActivo;
            
            if (this.localStream) {
                this.localStream.getAudioTracks().forEach(track => {
                    track.enabled = microfonoActivo;
                });
            }

            if (microfonoActivo) {
                micBtn.innerHTML = '<i class="fas fa-microphone"></i>';
                micBtn.classList.remove('muted');
                document.getElementById('miMicrofonoIcono').style.display = 'none';
            } else {
                micBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
                micBtn.classList.add('muted');
                document.getElementById('miMicrofonoIcono').style.display = 'inline-block';
            }
        });

        // 🔥 Botón de cámara
        camaraBtn.addEventListener('click', async () => {
            if (this.camaraActiva) {
                await this.desactivarCamara(camaraBtn);
            } else {
                await this.activarCamara(camaraBtn);
            }
        });

        // Botón de colgar
        colgarBtn.addEventListener('click', () => {
            Swal.fire({
                title: '¿Terminar llamada?',
                text: '¿Estás seguro de que deseas finalizar la llamada?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#D32F2F',
                cancelButtonColor: '#9E9E9E',
                confirmButtonText: 'Sí, colgar',
                cancelButtonText: 'Cancelar'
            }).then((result) => {
                if (result.isConfirmed) {
                    this.finalizarLlamada(true);
                }
            });
        });
    }

    async activarCamara(boton) {
        try {
            // Solicitar acceso a la cámara
            const videoStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });

            const videoTrack = videoStream.getVideoTracks()[0];
            
            // 🔥 Agregar el track de video al stream local
            this.localStream.addTrack(videoTrack);

            // 🔥 CRÍTICO: Agregar el track a la peer connection
            this.peerConnection.addTrack(videoTrack, this.localStream);
            
            this.camaraActiva = true;
            console.log("📹 Cámara activada y track agregado a peer connection");

            // Actualizar UI local
            boton.innerHTML = '<i class="fas fa-video"></i>';
            boton.classList.add('active');
            document.getElementById('miCamaraIcono').style.display = 'none';

            // Mostrar video local
            this.mostrarVideoLocal();

            // 🔥 NUEVO: Notificar al otro usuario
            this.socket.emit('camera-state-changed', {
                callId: this.callId,
                toUserId: this.remoteUserId,
                cameraEnabled: true
            });

            Swal.fire({
                icon: 'success',
                title: 'Cámara activada',
                text: 'El otro usuario ahora puede verte',
                timer: 1500,
                showConfirmButton: false
            });

        } catch (error) {
            console.error("❌ Error activando cámara:", error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudo acceder a la cámara. Verifica los permisos.',
                confirmButtonColor: '#D32F2F'
            });
        }
    }

    async desactivarCamara(boton) {
        try {
            // 🔥 Detener y remover todos los tracks de video
            const videoTracks = this.localStream.getVideoTracks();
            
            videoTracks.forEach(track => {
                track.stop();
                this.localStream.removeTrack(track);
            });

            // 🔥 Remover el sender de video de la peer connection
            const senders = this.peerConnection.getSenders();
            const videoSender = senders.find(sender => sender.track && sender.track.kind === 'video');
            
            if (videoSender) {
                this.peerConnection.removeTrack(videoSender);
            }

            this.camaraActiva = false;
            console.log("📹 Cámara desactivada y track removido");

            // Actualizar UI
            boton.innerHTML = '<i class="fas fa-video-slash"></i>';
            boton.classList.remove('active');
            document.getElementById('miCamaraIcono').style.display = 'inline-block';

            // Ocultar video local
            this.ocultarVideoLocal();

            // 🔥 NUEVO: Notificar al otro usuario
            this.socket.emit('camera-state-changed', {
                callId: this.callId,
                toUserId: this.remoteUserId,
                cameraEnabled: false
            });

        } catch (error) {
            console.error("❌ Error desactivando cámara:", error);
        }
    }

    mostrarVideoLocal() {
        const avatarDiv = document.querySelector('.usuario-actual .avatar-img');
        
        let videoElement = document.getElementById('localVideo');
        if (!videoElement) {
            videoElement = document.createElement('video');
            videoElement.id = 'localVideo';
            videoElement.autoplay = true;
            videoElement.muted = true;
            videoElement.playsInline = true; // 🔥 Importante para iOS
            videoElement.style.cssText = 'width: 100%; height: 100%; object-fit: cover; border-radius: 50%;';
        }

        videoElement.srcObject = this.localStream;
        avatarDiv.innerHTML = '';
        avatarDiv.appendChild(videoElement);
        
        console.log("📹 Video local mostrado");
    }

    ocultarVideoLocal() {
        const avatarDiv = document.querySelector('.usuario-actual .avatar-img');
        const videoElement = document.getElementById('localVideo');
        
        if (videoElement) {
            videoElement.srcObject = null;
            videoElement.remove();
        }

        avatarDiv.innerHTML = 'YO';
    }

    mostrarVideoRemoto() {
        const avatarDiv = document.querySelector('.otro-usuario .avatar-img');
        
        let videoElement = document.getElementById('remoteVideo');
        if (!videoElement) {
            videoElement = document.createElement('video');
            videoElement.id = 'remoteVideo';
            videoElement.autoplay = true;
            videoElement.playsInline = true; // 🔥 Importante para iOS
            videoElement.style.cssText = 'width: 100%; height: 100%; object-fit: cover; border-radius: 50%;';
        }

        // 🔥 IMPORTANTE: Asignar el remote stream
        videoElement.srcObject = this.remoteStream;
        
        avatarDiv.innerHTML = '';
        avatarDiv.appendChild(videoElement);

        console.log("📹 Video remoto mostrado");
    }

    ocultarVideoRemoto() {
        const avatarDiv = document.querySelector('.otro-usuario .avatar-img');
        const videoElement = document.getElementById('remoteVideo');
        
        if (videoElement) {
            videoElement.srcObject = null;
            videoElement.remove();
        }

        // Restaurar avatar con inicial
        const callData = JSON.parse(localStorage.getItem('currentCall') || '{}');
        const inicial = callData.remoteUser?.nombre?.charAt(0).toUpperCase() || 'U';
        avatarDiv.innerHTML = inicial;
        
        console.log("📹 Video remoto ocultado");
    }

    // 🔥 NUEVO: Actualizar icono de cámara del otro usuario
    actualizarIconoCamaraRemota(enabled) {
        const iconosEstado = document.querySelector('.otro-usuario .iconos-estado');
        const videoIcon = iconosEstado.querySelector('.fa-video-slash, .fa-video');
        
        if (enabled) {
            if (videoIcon) {
                videoIcon.className = 'fas fa-video';
            }
        } else {
            if (videoIcon) {
                videoIcon.className = 'fas fa-video-slash';
            }
        }
    }

    async finalizarLlamada(notificarServidor = true) {
        try {
            // Detener streams
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => track.stop());
            }
            if (this.remoteStream) {
                this.remoteStream.getTracks().forEach(track => track.stop());
            }

            // Cerrar peer connection
            if (this.peerConnection) {
                this.peerConnection.close();
            }

            // Notificar al servidor
            if (notificarServidor && this.callId) {
                await fetch(`/api/videollamadas/finalizar/${this.callId}`, {
                    method: 'POST',
                    headers: sesionManager.getAuthHeaders()
                });
            }

            // Limpiar localStorage
            localStorage.removeItem('currentCall');

            // Redirigir a chats
            window.location.href = '/chats';

        } catch (error) {
            console.error("❌ Error finalizando llamada:", error);
            window.location.href = '/chats';
        }
    }

    actualizarUIUsuario(usuario) {
        const participanteDiv = document.querySelector('.otro-usuario');
        if (participanteDiv) {
            const avatarDiv = participanteDiv.querySelector('.avatar-img');
            const nombreH3 = participanteDiv.querySelector('h3');
            const estadoP = participanteDiv.querySelector('p');

            if (usuario.foto) {
                avatarDiv.innerHTML = `<img src="../uploads/${usuario.foto}" alt="${usuario.nombre}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
            } else {
                avatarDiv.textContent = usuario.nombre.charAt(0).toUpperCase();
            }

            nombreH3.textContent = usuario.nombre;
            estadoP.textContent = 'Llamando...';
        }
    }

    actualizarEstadoLlamada(estado) {
        const estadoP = document.querySelector('.otro-usuario p');
        if (estadoP) {
            estadoP.textContent = estado;
        }
    }
}

// Inicializar
let callManager;

document.addEventListener('DOMContentLoaded', function() {
    if (typeof sesionManager === 'undefined') {
        console.error('❌ sesionManager no está disponible');
        window.location.href = '/login';
        return;
    }
    
    if (!sesionManager.isAuthenticated()) {
        window.location.href = '/login';
        return;
    }
    
    callManager = new CallManager();
});