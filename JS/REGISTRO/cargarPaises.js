// Función para cargar los países desde la base de datos
async function cargarPaises() {
    try {
        const selectPaises = document.getElementById('paises');
        
        // Verificar si el elemento existe
        if (!selectPaises) {
            console.error('Elemento select de países no encontrado');
            return;
        }

        const response = await fetch('/api/paises');
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const paises = await response.json();
        
        // Limpiar el select
        selectPaises.innerHTML = '<option value="" disabled selected>Seleccione su país</option>';
        
        // Llenar con los países de la base de datos
        paises.forEach(pais => {
            const option = document.createElement('option');
            option.value = pais.id;
            option.textContent = pais.nombre;
            selectPaises.appendChild(option);
        });
        
    } catch (error) {
        console.error('Error al cargar países:', error);
        
        // Solo intentar mostrar el error si el select existe
        const selectPaises = document.getElementById('paises');
        if (selectPaises) {
            selectPaises.innerHTML = '<option value="" disabled selected>Error al cargar países</option>';
        }
    }
}

// Cargar países cuando la página esté lista
document.addEventListener('DOMContentLoaded', cargarPaises);