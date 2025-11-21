// llamada.js - Funcionalidad para pantalla de llamada
document.addEventListener('DOMContentLoaded', function() {
    // Elementos DOM
    const micBtn = document.getElementById('micBtn');
    const camaraBtn = document.getElementById('camaraBtn');
    const colgarBtn = document.getElementById('colgarBtn');
    const miMicrofonoIcono = document.getElementById('miMicrofonoIcono');
    const miCamaraIcono = document.getElementById('miCamaraIcono');
    
    // Estados
    let microfonoActivo = true;
    let camaraActiva = false;
    
    // Inicializar la aplicación
    function inicializar() {
        configurarEventListeners();
        // La cámara comienza desactivada por defecto
        miCamaraIcono.style.display = 'inline-block';
    }
    
    // Configurar event listeners
    function configurarEventListeners() {
        // Botón de micrófono
        micBtn.addEventListener('click', toggleMicrofono);
        
        // Botón de cámara
        camaraBtn.addEventListener('click', toggleCamara);
        
        // Botón de colgar
        colgarBtn.addEventListener('click', confirmarColgarLlamada);
    }
    
    // Toggle micrófono
    function toggleMicrofono() {
        microfonoActivo = !microfonoActivo;
        
        if (microfonoActivo) {
            // Activar micrófono
            micBtn.innerHTML = '<i class="fas fa-microphone"></i>';
            micBtn.classList.remove('muted');
            miMicrofonoIcono.style.display = 'none';
            // Aquí iría el código para activar el micrófono realmente
        } else {
            // Desactivar micrófono
            micBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
            micBtn.classList.add('muted');
            miMicrofonoIcono.style.display = 'inline-block';
            // Aquí iría el código para desactivar el micrófono realmente
        }
    }
    
    // Toggle cámara
    function toggleCamara() {
        if (camaraActiva) {
            // Desactivar cámara
            desactivarCamara();
        } else {
            // Preguntar antes de activar la cámara
            Swal.fire({
                title: '¿Habilitar cámara?',
                text: '¿Deseas activar tu cámara para esta llamada?',
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#4CAF50',
                cancelButtonColor: '#D32F2F',
                confirmButtonText: 'Sí, activar',
                cancelButtonText: 'Cancelar'
            }).then((result) => {
                if (result.isConfirmed) {
                    activarCamara();
                }
            });
        }
    }
    
    // Activar cámara
    function activarCamara() {
        camaraActiva = true;
        camaraBtn.innerHTML = '<i class="fas fa-video"></i>';
        camaraBtn.classList.add('active');
        miCamaraIcono.style.display = 'none';
        
        // Aquí iría el código para activar la cámara realmente
        // Por ahora simulamos la activación
        
        // Cambiar el avatar por video (simulado)
        const usuarioActualAvatar = document.querySelector('.usuario-actual .avatar-img');
        usuarioActualAvatar.innerHTML = '🎥';
        usuarioActualAvatar.style.backgroundColor = '#4CAF50';
    }
    
    // Desactivar cámara
    function desactivarCamara() {
        camaraActiva = false;
        camaraBtn.innerHTML = '<i class="fas fa-video-slash"></i>';
        camaraBtn.classList.remove('active');
        miCamaraIcono.style.display = 'inline-block';
        
        // Aquí iría el código para desactivar la cámara realmente
        
        // Restaurar avatar normal
        const usuarioActualAvatar = document.querySelector('.usuario-actual .avatar-img');
        usuarioActualAvatar.innerHTML = 'YO';
        usuarioActualAvatar.style.backgroundColor = '';
    }
    
    // Confirmar colgar llamada
    function confirmarColgarLlamada() {
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
                colgarLlamada();
            }
        });
    }
    
    // Colgar llamada
    function colgarLlamada() {
        // Aquí iría el código para terminar la llamada realmente
        
        // Redirigir a chats.html
        window.location.href = 'chats.html';
    }
    
    // Inicializar la aplicación
    inicializar();
});