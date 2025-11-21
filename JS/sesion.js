class SesionManager {
    constructor() {
        this.token = localStorage.getItem('authToken');
        this.user = JSON.parse(localStorage.getItem('userData') || 'null');
        this.init();
    }

    init() {
        this.actualizarNavbar();
        this.verificarAutenticacion();
    }

    // Verificar si el usuario está autenticado
    isAuthenticated() {
        return !!this.token && !!this.user;
    }

    // Login
    async login(email, password) {
        try {
            const response = await fetch('/api/users/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.token = data.token;
                this.user = data.user;
                
                // Guardar en localStorage
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('userData', JSON.stringify(data.user));
                
                this.actualizarNavbar();
                return { success: true, data };
            } else {
                return { success: false, error: data.error };
            }
        } catch (error) {
            console.error('Error en login:', error);
            return { success: false, error: 'Error de conexión' };
        }
    }

    // Logout
    logout() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
        this.actualizarNavbar();
        window.location.href = '/';
    }

    //Ingresar al perfil

    // Actualizar navbar según estado de autenticación
    actualizarNavbar() {
        const navbarAuth = document.querySelector('.navbar-auth');
        const loginLink = document.querySelector('a[href="/login"]');
        
        if (this.isAuthenticated() && this.user) {
            // Usuario logueado - mostrar perfil
            if (loginLink) {
                loginLink.innerHTML = `

                    <style>
                        .user-menu
                        {
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            gap: 10px;
                        }
                        .userFoto{
                            width: 45px;
                            height: 45px;
                            border-radius: 50%;
                            object-fit: cover;
                        }
                    </style>
                    <div class="user-menu">
                        <span class="user-name">${this.user.nombreUsuario || this.user.nombre}</span>
                        <img class = 'userFoto' src="${this.user.foto ? '/uploads/' + this.user.foto : '/IMAGENES/default-avatar.png'}" 
                            alt="${this.user.nombre}" class="user-avatar">
                    </div>
                `;
                loginLink.href = '/perfil';
                
                // ELIMINAR el evento que muestra el menú de logout
                // Ahora el click simplemente llevará al perfil
                loginLink.replaceWith(loginLink.cloneNode(true));
            }
        } else {
            // Usuario no logueado - mostrar login
            if (loginLink) {
                loginLink.innerHTML = 'Iniciar sesión';
                loginLink.href = '/login';
            }
        }
    }
    // Mostrar menú de usuario (logout, etc.)
    mostrarMenuUsuario() {
        // Puedes implementar un dropdown menu aquí
        if (confirm('¿Deseas cerrar sesión?')) {
            this.logout();
        }
    }

    // Verificar autenticación en páginas protegidas
    verificarAutenticacion() {
        const protectedPages = ['/perfil', '/chats', '/torneos'];
        const currentPath = window.location.pathname;
        
        if (protectedPages.includes(currentPath) && !this.isAuthenticated()) {
            window.location.href = '/login';
        }
    }

    // Obtener headers con token para requests protegidos
    getAuthHeaders() {
        return {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
        };
    }

    // Verificar token con el servidor
    async verificarToken() {
        if (!this.token) return false;

        try {
            const response = await fetch('/api/user/profile', {
                headers: this.getAuthHeaders()
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }
}

// Instancia global
const sesionManager = new SesionManager();

// Para usar en otros archivos
window.sesionManager = sesionManager;