loginForm.addEventListener('submit', async function(e) {
    e.preventDefault(); // Prevenir el envío real del formulario

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (email && password) {
        try {
            // Mostrar loading
            Swal.fire({
                title: 'Iniciando sesión...',
                text: 'Por favor espere',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            // Enviar datos al backend
            const enviarDatos = await fetch('/api/users/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const result = await enviarDatos.json();

            if (enviarDatos.ok) {
                // Guardar la sesión usando el sesionManager
                if (window.sesionManager) {
                    // El sesionManager se encargará de guardar el token y datos del usuario
                    const loginResult = await window.sesionManager.login(email, password);
                    
                    if (loginResult.success) {
                        // Mostrar mensaje de éxito
                        Swal.fire({
                            title: '¡Éxito!',
                            text: 'Inicio de sesión exitoso',
                            icon: 'success',
                            confirmButtonText: 'Continuar',
                            timer: 3000, 
                            timerProgressBar: true
                        }).then((result) => {
                            // Redireccionar al inicio
                            window.location.href = "/";
                        });
                    } else {
                        throw new Error(loginResult.error);
                    }
                } else {
                    // Si no existe sesionManager, usar el método manual
                    localStorage.setItem('authToken', result.token);
                    localStorage.setItem('userData', JSON.stringify(result.user));
                    
                    Swal.fire({
                        title: '¡Éxito!',
                        text: 'Inicio de sesión exitoso',
                        icon: 'success',
                        confirmButtonText: 'Continuar',
                        timer: 3000, 
                        timerProgressBar: true
                    }).then((result) => {
                        window.location.href = "/";
                    });
                }
            } else {
                throw new Error(result.error || 'Error en el inicio de sesión');
            }

        } catch (error) {
            console.error('Error:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message || 'Error al iniciar sesión. Intenta nuevamente.'
            });
        }

    } else {
        Swal.fire({
            theme: 'bulma',
            icon: 'error',
            title: 'Error',
            text: 'Por favor, rellena todos los campos',
            confirmButtonText: 'Aceptar',
        });
    }
});