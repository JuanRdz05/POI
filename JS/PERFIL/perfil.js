class PerfilManager {
    constructor() {
        this.user = sesionManager.user;
        this.paises = [];
        this.init();
    }

    init() {
        this.cargarDatosUsuario();
        this.cargarPaises();
        this.agregarEventListeners();
        this.verificarAutenticacion();
    }

    verificarAutenticacion() {
        if (!sesionManager.isAuthenticated()) {
            window.location.href = '/login';
            return;
        }
    }

    async cargarPaises() {
        try {
            const response = await fetch('/api/paises');
            if (response.ok) {
                this.paises = await response.json();
                console.log('Países cargados:', this.paises);
            }
        } catch (error) {
            console.warn('Error cargando países:', error);
        }
    }

    async cargarDatosUsuario() {
        try {
            const response = await fetch('/api/profile/full-profile', {
                headers: sesionManager.getAuthHeaders()
            });

            if (response.ok) {
                const userData = await response.json();
                console.log('Datos completos del servidor:', userData);
                this.user = userData; // Actualizar datos del usuario
                this.actualizarInterfaz(userData);
            } else {
                console.warn('No se pudieron obtener datos completos del perfil:', response.status);
                // Usar datos básicos del sesionManager como fallback
                if (this.user) {
                    this.actualizarInterfaz(this.user);
                }
            }
        } catch (fetchError) {
            console.warn('Error fetching profile data:', fetchError);
            if (this.user) {
                this.actualizarInterfaz(this.user);
            }
        }
    }

    actualizarInterfaz(userData) {
        console.log('Datos completos del perfil:', userData);
        
        // Actualizar información básica
        const defaultAvatarPath = 'https://via.placeholder.com/200x200?text=User';
        document.getElementById('user-profile-img').src = 
            userData.foto ? `../uploads/${userData.foto}` : defaultAvatarPath;
        
        document.getElementById('user-username').textContent = 
            `@${userData.nombreUsuario || userData.nombre}`;
        
        // Usar los nombres EXACTOS de tu backend
        document.getElementById('user-nombre').textContent = userData.nombre || 'No especificado';
        
        // Combinar apellidos
        const apellidos = `${userData.apellidoPaterno || ''} ${userData.apellidoMaterno || ''}`.trim();
        document.getElementById('user-apellido').textContent = apellidos || 'No especificado';
        
        document.getElementById('user-email').textContent = userData.email || 'No especificado';
        document.getElementById('user-genero').textContent = userData.genero || 'No especificado';
        document.getElementById('user-cumpleanos').textContent = 
            this.formatearFecha(userData.fechaNacimiento) || 'No especificado';
        document.getElementById('user-pais').textContent = userData.pais || 'No especificado';
        
        // Cargar logros (si los tienes)
        this.cargarLogros(userData.logros || []);
    }

    cargarLogros(logros) {
        const logrosGrid = document.getElementById('logros-grid');
        const totalLogros = document.getElementById('total-logros');
        
        if (!logrosGrid) return;

        // Actualizar contador
        const logrosCompletados = logros.filter(logro => logro.completado).length;
        const totalLogrosCount = logros.length;
        
        if (totalLogros) {
            document.getElementById('total-logros').textContent = 
                `${logrosCompletados} de ${totalLogrosCount}`;
        }
        document.getElementById('user-logros').textContent = 
            `${logrosCompletados} de ${totalLogrosCount}`;

        // Generar HTML de logros
        logrosGrid.innerHTML = logros.map(logro => `
            <div class="logros-tarjeta ${logro.completado ? '' : 'sinCompletar'}">
                <div class="logros-texto">
                    <h3>${logro.nombre}</h3>
                    <p>${logro.descripcion}</p>
                </div>
                <div class="logros-imagen">
                    <img src="${logro.imagen || '../IMAGENES/logro-1.jpg'}" alt="${logro.nombre}">
                </div>
            </div>
        `).join('');
    }

    formatearFecha(fecha) {
        if (!fecha) return '';
        return new Date(fecha).toLocaleDateString('es-ES');
    }

    agregarEventListeners() {
    // Cerrar sesión
    document.getElementById('cerrar-sesion').addEventListener('click', () => {
        sesionManager.logout();
    });

    // Editar perfil
    document.getElementById('editar-perfil').addEventListener('click', () => {
        this.mostrarFormularioEdicion();
    });

    // Cambiar contraseña - AGREGAR ESTO
    const botonCambiarContrasena = document.createElement('button');
    botonCambiarContrasena.textContent = 'Cambiar contraseña';
    botonCambiarContrasena.className = 'boton-cambiar-contrasena';
    botonCambiarContrasena.style.cssText = `
        background: #4CAF50;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 5px;
        cursor: pointer;
        margin: 10px 5px;
        font-size: 14px;
    `;
    
    botonCambiarContrasena.addEventListener('click', () => {
        this.mostrarFormularioCambioContrasena();
    });

    // Insertar el botón después del botón de editar perfil
    const botonEditar = document.getElementById('editar-perfil');
    botonEditar.parentNode.insertBefore(botonCambiarContrasena, botonEditar.nextSibling);
}

mostrarFormularioCambioContrasena() {
    Swal.fire({
        title: 'Cambiar contraseña',
        html: `
            <form id="change-password-form">
                <div class="form-group">
                    <label for="current-password">Contraseña actual *</label>
                    <input type="password" id="current-password" class="swal2-input" 
                           placeholder="Ingresa tu contraseña actual" required>
                </div>
                
                <div class="form-group">
                    <label for="new-password">Nueva contraseña *</label>
                    <input type="password" id="new-password" class="swal2-input" 
                           placeholder="Ingresa tu nueva contraseña" required
                           minlength="6">
                    <small style="text-align: left; display: block; color: #666; margin-top: 5px;">
                        Mínimo 6 caracteres
                    </small>
                </div>
                
                <div class="form-group">
                    <label for="confirm-password">Confirmar nueva contraseña *</label>
                    <input type="password" id="confirm-password" class="swal2-input" 
                           placeholder="Confirma tu nueva contraseña" required>
                </div>
            </form>
        `,
        width: '500px',
        showCancelButton: true,
        confirmButtonText: 'Cambiar contraseña',
        cancelButtonText: 'Cancelar',
        preConfirm: async () => {
            const result = await this.cambiarContrasena();
            if (result && result.success) {
                // Cerrar el modal de cambio de contraseña
                Swal.close();
                // Mostrar mensaje de éxito
                Swal.fire({
                    title: '¡Éxito!',
                    text: result.message,
                    icon: 'success',
                    timer: 3000,
                    showConfirmButton: false
                });
                return true;
            }
            return false;
        },
        didOpen: () => {
            // Agregar estilos para los labels y mensajes
            const style = document.createElement('style');
            style.textContent = `
                .form-group {
                    margin-bottom: 15px;
                    text-align: left;
                }
                .form-group label {
                    display: block;
                    margin-bottom: 5px;
                    font-weight: bold;
                    color: #333;
                }
                .swal2-input {
                    width: 100% !important;
                    margin: 5px 0 !important;
                }
                small {
                    font-size: 12px;
                }
            `;
            document.head.appendChild(style);
        }
    });
}

async cambiarContrasena() {
    try {
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        // Validaciones en el frontend
        if (!currentPassword || !newPassword || !confirmPassword) {
            Swal.showValidationMessage('Todos los campos son obligatorios');
            return false;
        }

        if (newPassword.length < 6) {
            Swal.showValidationMessage('La nueva contraseña debe tener al menos 6 caracteres');
            return false;
        }

        if (newPassword !== confirmPassword) {
            Swal.showValidationMessage('Las nuevas contraseñas no coinciden');
            return false;
        }

        console.log('🔐 Enviando solicitud de cambio de contraseña...');

        const response = await fetch('/api/profile/change-password', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...sesionManager.getAuthHeaders()
            },
            body: JSON.stringify({
                currentPassword,
                newPassword,
                confirmPassword
            })
        });

        const result = await response.json();

        if (response.ok) {
            // Cerrar el modal actual primero
            Swal.close();
            
            // Mostrar mensaje de éxito
            Swal.fire({
                title: '¡Éxito!',
                text: 'Contraseña actualizada correctamente',
                icon: 'success',
                timer: 3000,
                showConfirmButton: false
            });
            
            return true;
        } else {
            throw new Error(result.error || 'Error al cambiar la contraseña');
        }

    } catch (error) {
        console.error('❌ Error cambiando contraseña:', error);
        Swal.showValidationMessage(`Error: ${error.message}`);
        return false;
    }
}

    async mostrarFormularioEdicion() {
    // Asegurarse de que los países estén cargados
    if (this.paises.length === 0) {
        await this.cargarPaises();
    }

    // Crear opciones de países
    const opcionesPaises = this.paises.map(pais => 
        `<option value="${pais.id}" ${pais.id === this.user.id_pais ? 'selected' : ''}>
            ${pais.nombre}
        </option>`
    ).join('');

    // ✅ Formatear fecha correctamente para input type="date" (YYYY-MM-DD)
    let fechaFormateada = '';
    if (this.user.fechaNacimiento) {
        try {
            const fecha = new Date(this.user.fechaNacimiento);
            // Formatear como YYYY-MM-DD
            fechaFormateada = fecha.toISOString().split('T')[0];
        } catch (e) {
            console.warn('Error formateando fecha:', e);
        }
    }

    Swal.fire({
        title: 'Editar perfil',
        html: `
            <form id="edit-profile-form">
                <div class="form-group">
                    <label for="edit-nombre">Nombre *</label>
                    <input type="text" id="edit-nombre" class="swal2-input" 
                           value="${this.user.nombre || ''}" placeholder="Nombre" required>
                </div>
                
                <div class="form-group">
                    <label for="edit-apellidoPaterno">Apellido Paterno</label>
                    <input type="text" id="edit-apellidoPaterno" class="swal2-input" 
                           value="${this.user.apellidoPaterno || ''}" placeholder="Apellido paterno">
                </div>
                
                <div class="form-group">
                    <label for="edit-apellidoMaterno">Apellido Materno</label>
                    <input type="text" id="edit-apellidoMaterno" class="swal2-input" 
                           value="${this.user.apellidoMaterno || ''}" placeholder="Apellido materno">
                </div>
                
                <div class="form-group">
                    <label for="edit-email">Email *</label>
                    <input type="email" id="edit-email" class="swal2-input" 
                           value="${this.user.email || ''}" placeholder="Email" required>
                </div>
                
                <div class="form-group">
                    <label for="edit-genero">Género</label>
                    <select id="edit-genero" class="swal2-input">
                        <option value="">Seleccionar género</option>
                        <option value="Masculino" ${this.user.genero === 'Masculino' ? 'selected' : ''}>Masculino</option>
                        <option value="Femenino" ${this.user.genero === 'Femenino' ? 'selected' : ''}>Femenino</option>
                        <option value="Otro" ${this.user.genero === 'Otro' ? 'selected' : ''}>Otro</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="edit-fechaNacimiento">Fecha de Nacimiento</label>
                    <input type="date" id="edit-fechaNacimiento" class="swal2-input" 
                           value="${fechaFormateada}">
                    <small style="display: block; color: #666; margin-top: 5px;">
                        ${this.user.fechaNacimiento ? 'Actual: ' + this.formatearFecha(this.user.fechaNacimiento) : 'No especificada'}
                    </small>
                </div>
                
                <div class="form-group">
                    <label for="edit-pais">País</label>
                    <select id="edit-pais" class="swal2-input">
                        <option value="">Seleccionar país</option>
                        ${opcionesPaises}
                    </select>
                </div>
            </form>
        `,
        width: '600px',
        showCancelButton: true,
        confirmButtonText: 'Guardar cambios',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
            return this.guardarCambiosPerfil();
        },
        didOpen: () => {
            // Agregar estilos para los labels
            const style = document.createElement('style');
            style.textContent = `
                .form-group {
                    margin-bottom: 15px;
                    text-align: left;
                }
                .form-group label {
                    display: block;
                    margin-bottom: 5px;
                    font-weight: bold;
                    color: #333;
                }
                .form-group small {
                    font-size: 12px;
                    font-style: italic;
                }
                .swal2-input, .swal2-select {
                    width: 100% !important;
                }
            `;
            document.head.appendChild(style);
        }
    });
}

async guardarCambiosPerfil() {
    try {
        const fechaNacimientoInput = document.getElementById('edit-fechaNacimiento').value;
        const paisInput = document.getElementById('edit-pais').value;

        const datosActualizados = {
            nombre: document.getElementById('edit-nombre').value,
            apellidoPaterno: document.getElementById('edit-apellidoPaterno').value,
            apellidoMaterno: document.getElementById('edit-apellidoMaterno').value,
            email: document.getElementById('edit-email').value,
            genero: document.getElementById('edit-genero').value
        };

        // ✅ Solo incluir fechaNacimiento si realmente hay un valor nuevo
        if (fechaNacimientoInput && fechaNacimientoInput.trim() !== '') {
            datosActualizados.fechaNacimiento = fechaNacimientoInput;
        }
        // Si está vacío, simplemente no lo incluimos en el objeto

        // ✅ Solo incluir id_pais si hay un valor seleccionado
        if (paisInput && paisInput.trim() !== '') {
            datosActualizados.id_pais = paisInput;
        }

        console.log('📤 Enviando datos:', datosActualizados);

        // Validaciones básicas
        if (!datosActualizados.nombre.trim()) {
            Swal.showValidationMessage('El nombre es obligatorio');
            return false;
        }

        if (!datosActualizados.email.trim()) {
            Swal.showValidationMessage('El email es obligatorio');
            return false;
        }

        const response = await fetch('/api/profile/full-profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...sesionManager.getAuthHeaders()
            },
            body: JSON.stringify(datosActualizados)
        });

        console.log('📨 Respuesta del servidor:', response.status);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        // ✅ Cerrar el modal de edición primero
        Swal.close();

        // ✅ Mostrar mensaje de éxito
        Swal.fire({
            icon: 'success',
            title: '¡Éxito!',
            text: 'Perfil actualizado correctamente',
            timer: 2000,
            showConfirmButton: false
        });

        // ✅ Recargar TODOS los datos (incluyendo logros)
        await this.cargarDatosUsuario();
        
        // ✅ Recargar los logros explícitamente si existe el manager
        if (window.logrosManager) {
            await window.logrosManager.cargarLogros();
            window.logrosManager.actualizarContadorLogros();
        }

        return true;

    } catch (error) {
        console.error('❌ Error guardando cambios:', error);
        Swal.showValidationMessage(`Error: ${error.message}`);
        return false;
    }
}
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    new PerfilManager();
});

// Funcionalidad para alternar entre pestañas
document.addEventListener('DOMContentLoaded', function() {
    const botonesOpcion = document.querySelectorAll('.boton-opcion');
    
    botonesOpcion.forEach(boton => {
        boton.addEventListener('click', function() {
            const target = this.getAttribute('data-target');
            
            botonesOpcion.forEach(btn => btn.classList.remove('activo'));
            this.classList.add('activo');
            
            document.querySelectorAll('.infoPerfil-container, .logros-container').forEach(container => {
                container.classList.remove('activo');
            });
            
            document.getElementById(target).classList.add('activo');
        });
    });
    
    // Botón de cerrar sesión
    const botonCerrarSesion = document.querySelector('.boton-cerrarSesion');
    if (botonCerrarSesion) {
        botonCerrarSesion.addEventListener('click', function() {
            Swal.fire({
                title: '¿Cerrar sesión?',
                text: "Estás a punto de cerrar tu sesión",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#D32F2F',
                cancelButtonColor: '#666',
                confirmButtonText: 'Sí, cerrar sesión',
                cancelButtonText: 'Cancelar'
            }).then((result) => {
                if (result.isConfirmed) {
                    Swal.fire({
                        title: 'Cerrando sesión...',
                        icon: 'success',
                        text: 'Por favor, espera un momento',
                        timer: 2000,
                        timerProgressBar: true,
                        showConfirmButton: false,
                        willClose: () => {
                            window.location.href = '/login';
                        }
                    });
                }
            });
        });
    }
});