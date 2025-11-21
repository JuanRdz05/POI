// JS/PERFIL/logrosFront.js
class LogrosManager {
    constructor() {
        this.logros = [];
        this.marcoActivo = null;
        this.init();
    }

    init() {
        // Verificar autenticación antes de cargar
        if (!sesionManager.isAuthenticated()) {
            console.error('❌ Usuario no autenticado');
            Swal.fire({
                icon: 'error',
                title: 'No autenticado',
                text: 'Por favor inicia sesión',
                confirmButtonColor: '#D32F2F'
            }).then(() => {
                window.location.href = '/login';
            });
            return;
        }

        console.log('✅ Iniciando LogrosManager');
        console.log('🔑 Token disponible:', !!sesionManager.token);
        console.log('👤 Usuario:', sesionManager.user?.nombreUsuario || sesionManager.user?.nombre);
        
        this.cargarLogros();
        this.cargarMarcoActivo();
        this.verificarProgreso();
    }

    async cargarLogros() {
        try {
            console.log('📊 Cargando logros...');
            
            const headers = sesionManager.getAuthHeaders();
            console.log('📤 Headers enviados:', headers);

            const response = await fetch('/api/logros/mis-logros', {
                headers: headers
            });

            console.log('📥 Response status:', response.status);

            if (response.status === 401) {
                console.error('❌ Token inválido o expirado');
                Swal.fire({
                    icon: 'error',
                    title: 'Sesión expirada',
                    text: 'Por favor inicia sesión nuevamente',
                    confirmButtonColor: '#D32F2F'
                }).then(() => {
                    sesionManager.logout();
                });
                return;
            }

            if (response.status === 403) {
                console.error('❌ Token no válido');
                throw new Error('Token no válido');
            }

            if (response.ok) {
                this.logros = await response.json();
                console.log('✅ Logros cargados:', this.logros.length);
                this.renderizarLogros();
                this.actualizarContadorLogros();
            } else {
                const errorData = await response.json();
                console.error('❌ Error en respuesta:', errorData);
                throw new Error(errorData.error || 'Error desconocido');
            }
        } catch (error) {
            console.error('❌ Error cargando logros:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudieron cargar los logros: ' + error.message,
                confirmButtonColor: '#D32F2F'
            });
        }
    }

    async verificarProgreso() {
        try {
            console.log('🔄 Verificando progreso...');
            
            const response = await fetch('/api/logros/verificar-progreso', {
                method: 'POST',
                headers: sesionManager.getAuthHeaders()
            });

            if (response.ok) {
                const data = await response.json();
                console.log('✅ Progreso verificado:', data);

                // Mostrar notificación si hay logros recién desbloqueados
                if (data.logrosDesbloqueados && data.logrosDesbloqueados.length > 0) {
                    this.mostrarNotificacionLogros(data.logrosDesbloqueados);
                }

                // Recargar logros para mostrar actualización
                await this.cargarLogros();
            } else if (response.status === 401 || response.status === 403) {
                console.warn('⚠️ Error de autenticación al verificar progreso');
                // No redirigir aquí, ya se manejó en cargarLogros
            }
        } catch (error) {
            console.error('❌ Error verificando progreso:', error);
            // No mostrar error al usuario, es un proceso en background
        }
    }

    async cargarMarcoActivo() {
        try {
            console.log('🎨 Cargando marco activo...');
            
            const response = await fetch('/api/logros/marco-activo', {
                headers: sesionManager.getAuthHeaders()
            });

            if (response.ok) {
                const data = await response.json();
                this.marcoActivo = data.marco;
                console.log('✅ Marco activo:', this.marcoActivo);
                this.aplicarMarco();
            }
        } catch (error) {
            console.error('❌ Error cargando marco activo:', error);
        }
    }

    renderizarLogros() {
        const logrosGrid = document.getElementById('logros-grid');
        if (!logrosGrid) {
            console.warn('⚠️ Elemento logros-grid no encontrado');
            return;
        }

        if (this.logros.length === 0) {
            logrosGrid.innerHTML = '<p class="no-logros">No hay logros disponibles</p>';
            return;
        }

        logrosGrid.innerHTML = this.logros.map(logro => {
            const porcentaje = Math.min((logro.progreso_actual / logro.condicion_valor) * 100, 100);
            const bloqueado = !logro.completado;

            return `
                <div class="logro-tarjeta ${bloqueado ? 'logro-bloqueado' : 'logro-desbloqueado'}" 
                     data-logro-id="${logro.id_logro}">
                    <div class="logro-contenido">
                        <div class="logro-imagen">
                            <img src="${logro.icono || '../IMAGENES/logro-default.png'}" 
                                 alt="${logro.nombre}"
                                 class="${bloqueado ? 'logro-imagen-bloqueada' : ''}">
                            ${bloqueado ? '<div class="logro-candado"><i class="fas fa-lock"></i></div>' : ''}
                        </div>
                        <div class="logro-info">
                            <h3 class="logro-nombre">${logro.nombre}</h3>
                            <p class="logro-descripcion">${logro.descripcion}</p>
                            <div class="logro-progreso">
                                <div class="logro-barra-fondo">
                                    <div class="logro-barra-progreso" 
                                         style="width: ${porcentaje}%"></div>
                                </div>
                                <span class="logro-texto-progreso">
                                    ${logro.progreso_actual} / ${logro.condicion_valor}
                                </span>
                            </div>
                            ${logro.completado ? `
                                <button class="boton-equipar-marco" 
                                        data-logro-id="${logro.id_logro}"
                                        data-marco="${logro.marco}">
                                    <i class="fas fa-check-circle"></i> Equipar Marco
                                </button>
                            ` : ''}
                            ${logro.completado && logro.fecha_desbloqueo ? `
                                <p class="logro-fecha">
                                    Desbloqueado: ${this.formatearFecha(logro.fecha_desbloqueo)}
                                </p>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Agregar event listeners a los botones de equipar
        document.querySelectorAll('.boton-equipar-marco').forEach(boton => {
            boton.addEventListener('click', (e) => {
                const logroId = e.currentTarget.dataset.logroId;
                this.equiparMarco(logroId);
            });
        });

        console.log('✅ Logros renderizados:', this.logros.length);
    }

    actualizarContadorLogros() {
        const totalLogros = document.getElementById('total-logros');
        const userLogros = document.getElementById('user-logros');
        
        const completados = this.logros.filter(l => l.completado).length;
        const total = this.logros.length;
        const texto = `${completados} de ${total}`;

        if (totalLogros) totalLogros.textContent = texto;
        if (userLogros) userLogros.textContent = texto;
    }

    async equiparMarco(logroId) {
        try {
            Swal.fire({
                title: 'Equipando marco...',
                text: 'Por favor espera',
                allowOutsideClick: false,
                showConfirmButton: false,
                willOpen: () => {
                    Swal.showLoading();
                }
            });

            const response = await fetch('/api/logros/equipar-marco', {
                method: 'POST',
                headers: sesionManager.getAuthHeaders(),
                body: JSON.stringify({ id_logro: parseInt(logroId) })
            });

            if (response.ok) {
                const data = await response.json();
                this.marcoActivo = data.marco;
                this.aplicarMarco();

                Swal.fire({
                    icon: 'success',
                    title: '¡Marco equipado!',
                    text: `Has equipado: ${data.nombre}`,
                    timer: 2000,
                    showConfirmButton: false
                });
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Error al equipar marco');
            }
        } catch (error) {
            console.error('❌ Error equipando marco:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message,
                confirmButtonColor: '#D32F2F'
            });
        }
    }

    aplicarMarco() {
        const bannerContainer = document.querySelector('.banner-container');
        const imagenPerfil = document.querySelector('.imagen-perfil');
        
        if (!bannerContainer || !imagenPerfil) return;

        // Remover marcos anteriores
        const marcoAnterior = document.querySelector('.marco-perfil');
        if (marcoAnterior) marcoAnterior.remove();

        if (this.marcoActivo) {
            // Crear elemento de marco
            const marco = document.createElement('div');
            marco.className = 'marco-perfil';
            marco.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 220px;
                height: 220px;
                background-image: url('${this.marcoActivo}');
                background-size: contain;
                background-repeat: no-repeat;
                background-position: center;
                pointer-events: none;
                z-index: 10;
            `;
            
            imagenPerfil.style.position = 'relative';
            imagenPerfil.appendChild(marco);
        }
    }

    mostrarNotificacionLogros(logrosDesbloqueados) {
        logrosDesbloqueados.forEach((logro, index) => {
            setTimeout(() => {
                Swal.fire({
                    icon: 'success',
                    title: '🎉 ¡Logro Desbloqueado!',
                    text: logro.nombre,
                    timer: 3000,
                    showConfirmButton: false,
                    position: 'top-end',
                    toast: true,
                    background: '#4CAF50',
                    color: '#fff'
                });
            }, index * 1000);
        });
    }

    formatearFecha(fecha) {
        if (!fecha) return '';
        const date = new Date(fecha);
        return date.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM cargado, inicializando LogrosManager...');
    
    // Verificar que sesionManager esté disponible
    if (typeof sesionManager === 'undefined') {
        console.error('❌ sesionManager no está definido');
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Sistema de sesión no disponible',
            confirmButtonColor: '#D32F2F'
        });
        return;
    }

    if (sesionManager.isAuthenticated()) {
        console.log('✅ Usuario autenticado, inicializando logros...');
        window.logrosManager = new LogrosManager();
    } else {
        console.warn('⚠️ Usuario no autenticado');
    }
});