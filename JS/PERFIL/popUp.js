const botonPersonalizacion = document.getElementById('personalizacion');
const modalPersonalizacion = document.querySelector('.modal-personalizacion');
const modalCerrar = document.querySelector('.modal-cerrar');
const botonCancelar = document.querySelector('.boton-cancelar');
if (botonPersonalizacion) {
    botonPersonalizacion.addEventListener('click', function() {
        modalPersonalizacion.classList.add('activo');
    });
}

if (modalCerrar) {
    modalCerrar.addEventListener('click', function() {
        modalPersonalizacion.classList.remove('activo');
    });
}

// Cerrar modal al hacer clic fuera del contenido
modalPersonalizacion.addEventListener('click', function(e) {
    if (e.target === modalPersonalizacion) {
        modalPersonalizacion.classList.remove('activo');
    }
});

//Cancelar modal al hacer clic fuera del contenido
if (botonCancelar) {
    botonCancelar.addEventListener('click', cerrarModal);
}

// Pestañas dentro del modal de personalización
const botonesMenuPersonalizacion = document.querySelectorAll('.boton-menu-personalizacion');
const contenidosPersonalizacion = document.querySelectorAll('.contenido-personalizacion');

botonesMenuPersonalizacion.forEach(boton => {
    boton.addEventListener('click', function() {
        const target = this.id.replace('boton', '').toLowerCase();
        
        // Desactivar todos los botones y contenidos
        botonesMenuPersonalizacion.forEach(btn => btn.classList.remove('activo'));
        contenidosPersonalizacion.forEach(contenido => contenido.classList.remove('activo'));
        
        // Activar el botón y contenido seleccionado
        this.classList.add('activo');
        document.querySelector(`.${target}-personalizacion`).classList.add('activo');
    });
});

// Previsualización del banner
const inputBanner = document.querySelector('.foto-banner-input');
const previsualizacionBanner = document.querySelector('.previsualizacion-banner');

if (inputBanner && previsualizacionBanner) {
    inputBanner.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                previsualizacionBanner.style.backgroundImage = `url(${e.target.result})`;
            };
            reader.readAsDataURL(file);
        }
    });
}

// Confirmar cambio de banner
const botonConfirmarBanner = document.querySelector('.boton-confirmar');

if (botonConfirmarBanner) {
    botonConfirmarBanner.addEventListener('click', function() {
        const nuevaImagen = previsualizacionBanner.style.backgroundImage;
        if (nuevaImagen && nuevaImagen !== 'none') {
            // Aquí iría la lógica para guardar el banner en tu base de datos
            Swal.fire({
                icon: 'success',
                title: '¡Banner actualizado!',
                text: 'Tu banner se ha cambiado correctamente.',
                confirmButtonColor: '#D32F2F'
            });
            
            // Cerrar el modal después de guardar
            setTimeout(() => {
                modalPersonalizacion.classList.remove('activo');
            }, 1500);
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Por favor, selecciona una imagen primero.',
                confirmButtonColor: '#D32F2F'
            });
        }
    });
}

// Selección de recompensas
const recompensas = document.querySelectorAll('.recompensa-tarjeta');

recompensas.forEach(recompensa => {
    recompensa.addEventListener('click', function() {
        if (this.classList.contains('desbloqueada')) {
            // Deseleccionar todas las recompensas
            recompensas.forEach(r => r.classList.remove('seleccionada'));
            
            // Seleccionar la recompensa clickeada
            this.classList.add('seleccionada');
            
            // Aquí iría la lógica para guardar la recompensa seleccionada
            const nombreRecompensa = this.querySelector('h4').textContent;
            Swal.fire({
                icon: 'success',
                title: 'Recompensa equipada',
                text: `Has equipado: ${nombreRecompensa}`,
                confirmButtonColor: '#D32F2F',
                timer: 1500
            });
        } else {
            Swal.fire({
                icon: 'info',
                title: 'Recompensa bloqueada',
                text: 'Necesitas desbloquear esta recompensa antes de poder equiparla.',
                confirmButtonColor: '#D32F2F'
            });
        }
    });
});

 // ===== SISTEMA DE PERSONALIZACIÓN DE BANNER =====
const botonConfirmar = document.querySelector('.boton-confirmar');
let archivoSeleccionado = null;
    
if (inputBanner && previsualizacionBanner) {
    inputBanner.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            // Validar tipo de archivo
            if (!file.type.match('image/jpeg') && !file.type.match('image/png')) {
                Swal.fire({
                    icon: 'error',
                    title: 'Formato no válido',
                    text: 'Por favor, selecciona una imagen JPEG o PNG',
                    confirmButtonColor: '#D32F2F'
                });
                this.value = '';
                return;
            }
            
            // Validar tamaño de archivo (máximo 5MB)
            if (file.size > 5 * 1024 * 1024) {
                Swal.fire({
                    icon: 'error',
                    title: 'Archivo demasiado grande',
                    text: 'La imagen no debe superar los 5MB',
                    confirmButtonColor: '#D32F2F'
                });
                this.value = '';
                return;
            }
            
            archivoSeleccionado = file;
            const reader = new FileReader();
            reader.onload = function(e) {
                previsualizacionBanner.style.backgroundImage = `url(${e.target.result})`;
            };
            reader.readAsDataURL(file);
        }
    });
}

// Confirmar cambio de banner
if (botonConfirmar) {
    botonConfirmar.addEventListener('click', function() {
        if (!archivoSeleccionado) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Por favor, selecciona una imagen primero',
                confirmButtonColor: '#D32F2F'
            });
            return;
        }
        
        // Aquí normalmente enviarías la imagen al servidor
        // Por ahora simularemos el proceso
        
        Swal.fire({
            title: '¿Cambiar banner?',
            text: "¿Estás seguro de que quieres actualizar tu banner?",
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#D32F2F',
            cancelButtonColor: '#666',
            confirmButtonText: 'Sí, cambiar',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {

                Swal.fire({
                    title: 'Actualizando banner...',
                    text: 'Por favor, espera un momento',
                    icon: 'info',
                    showConfirmButton: false,
                    allowOutsideClick: false,
                    didOpen: () => {
                        Swal.showLoading();
                    }
                });
                
                // Simular tiempo de carga
                setTimeout(() => {
                    // Obtener la URL de la previsualización
                    const nuevaImagenURL = previsualizacionBanner.style.backgroundImage;
                    
                    // Cambiar el banner principal (simulación)
                    const bannerContainer = document.querySelector('.banner-container');
                    // Aquí cambiamos la imagen del banner a un url de la previsualizacin 
                    bannerContainer.style.backgroundImage = nuevaImagenURL;
                    //Le ponesmos el estilo y posición de la imagen
                    bannerContainer.style.backgroundSize = 'cover';
                    bannerContainer.style.backgroundPosition = 'center';
                    
                    // Aquí lo guardamos en la localStorage, pero en todo caso estaríamos guardandolo en la DB
                    localStorage.setItem('userBanner', previsualizacionBanner.style.backgroundImage.replace(/"/g, ""));

                    Swal.fire({
                        icon: 'success',
                        title: '¡Banner actualizado!',
                        text: 'Tu banner se ha cambiado correctamente.',
                        confirmButtonColor: '#D32F2F',
                        timer: 1500
                    });
                    
                    // Cerrar el modal después de guardar
                    cerrarModal();
                }, 2000);
            }
        });
    });
}

function cerrarModal() {
    modalPersonalizacion.classList.remove('activo');
}

    // Cargar banner guardado al iniciar la página
function cargarBannerGuardado() {
    const bannerGuardado = localStorage.getItem('userBanner');
    if (bannerGuardado) {
        const bannerContainer = document.querySelector('.banner-container');
        bannerContainer.style.backgroundImage = bannerGuardado;
        bannerContainer.style.backgroundSize = 'cover';
        bannerContainer.style.backgroundPosition = 'center';
    }
}

// Ejecutar al cargar la página
cargarBannerGuardado();
