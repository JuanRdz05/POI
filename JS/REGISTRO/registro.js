registerForm.addEventListener('submit', async function(e) {
    e.preventDefault(); // Prevenir el envío real del formulario
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const foto = document.getElementById('foto').files[0];
    const nombre = document.getElementById('nombre').value;
    const apellidoPaterno = document.getElementById('apellidoPaterno').value;
    const apellidoMaterno = document.getElementById('apellidoMaterno').value;
    const nombreUsuario = document.getElementById('usuario').value;
    const genero = document.getElementById('genero').value;
    const fechaNacimiento = document.getElementById('cumpleaños').value;
    const id_pais = document.getElementById('paises').value;

    if (email && password && nombre && apellidoPaterno && apellidoMaterno && nombreUsuario && genero && fechaNacimiento && id_pais) {
        
        try {
            // Mostrar loading
            Swal.fire({
                title: 'Registrando...',
                text: 'Por favor espere',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            // Crear FormData para enviar los datos (incluyendo la imagen)
            const formData = new FormData();
            formData.append('correo', email);
            formData.append('contrasena', password);
            formData.append('nombre', nombre);
            formData.append('apellidoPaterno', apellidoPaterno);
            formData.append('apellidoMaterno', apellidoMaterno);
            formData.append('nombreUsuario', nombreUsuario);
            formData.append('genero', genero);
            formData.append('fechaNacimiento', fechaNacimiento);
            formData.append('id_pais', id_pais);
            
            if (foto) {
                formData.append('foto', foto);
            }

            // Enviar datos al backend
            const enviarDatos = await fetch('/api/users/register', {
                method: 'POST',
                body: formData
            });

            const result = await enviarDatos.json();

            if (enviarDatos.ok) {
                // Mostrar mensaje de éxito
                Swal.fire({
                    title: '¡Éxito!',
                    text: 'Registro exitoso',
                    icon: 'success',
                    confirmButtonText: 'Continuar',
                    timer: 3000, 
                    timerProgressBar: false,
                }).then((result) => {
                    // Redireccionar después de que el usuario haga clic o pase el tiempo
                    window.location.href = "/";
                });
            } else {
                throw new Error(result.error || 'Error en el registro');
            }

        } catch (error) {
            console.error('Error:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message || 'Error al registrar usuario. Intenta nuevamente.'
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