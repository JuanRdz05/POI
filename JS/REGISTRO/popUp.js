document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('paisModal');
    const cerrarModal = document.getElementById('cerrarModal');
    const confirmarPais = document.getElementById('confirmarPais');
    const simularRegistro = document.getElementById('simularRegistro');
    
    // Simular registro exitoso (en tu código real, esto se activaría automáticamente)
    simularRegistro.addEventListener('click', function() {
        modal.classList.add('active');
    });
    
    // Cerrar modal
    cerrarModal.addEventListener('click', function() {
        modal.classList.remove('active');
    });
    
    // Confirmar selección de país
    confirmarPais.addEventListener('click', function() {
        const selectPais = document.getElementById('paises');
        if (selectPais.value) {
            alert(`¡País ${selectPais.value} seleccionado con éxito!`);
            modal.classList.remove('active');
        } else {
            alert('Por favor, seleccione un país');
        }
    });
    
    // Cerrar modal al hacer clic fuera del contenido
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
});