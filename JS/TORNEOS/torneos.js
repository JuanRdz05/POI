// torneos.js - Versión conectada al backend
document.addEventListener('DOMContentLoaded', function() {
    // Variables globales
    let presupuestoActual = 200;
    let jugadoresSeleccionados = {};
    let posicionActual = '';
    
    // Elementos DOM
    const presupuestoElement = document.getElementById('presupuesto-actual');
    const btnComenzar = document.getElementById('btn-comenzar');
    const modal = document.getElementById('modal-jugadores');
    const closeModal = document.querySelector('.close-modal');
    const jugadoresGrid = document.getElementById('jugadores-grid');
    
    // Token de autenticación
    const token = localStorage.getItem('authToken');
    
    // Colores para las iniciales de jugadores
    const colores = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA5A5', '#77DD77', '#FDFD96', '#FFB347', '#B19CD9', '#FF6961', '#CB99C9'];
    
    // Inicializar la página
    async function inicializar() {
        await cargarEquipoBackend();
        await actualizarPresupuestoBackend();
        configurarEventListeners();
        await verificarEquipoCompletoBackend();
    }
    
    // Cargar equipo desde el backend
    async function cargarEquipoBackend() {
        if (!token) {
            console.warn('No hay token de autenticación');
            return;
        }
        
        try {
            const response = await fetch('/api/jugadores/equipo', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const equipo = await response.json();
                jugadoresSeleccionados = {};
                
                equipo.forEach(jugadorEnEquipo => {
                    jugadoresSeleccionados[jugadorEnEquipo.posicion_cancha] = {
                        id: jugadorEnEquipo.id_jugador,
                        nombre: jugadorEnEquipo.nombre,
                        posicion: jugadorEnEquipo.posicion,
                        precio: jugadorEnEquipo.precio,
                        velocidad: jugadorEnEquipo.velocidad,
                        fuerza: jugadorEnEquipo.fuerza,
                        iniciales: jugadorEnEquipo.iniciales
                    };
                    
                    actualizarPosicionCancha(jugadorEnEquipo.posicion_cancha, jugadoresSeleccionados[jugadorEnEquipo.posicion_cancha]);
                });
                
                console.log('Equipo cargado desde backend:', jugadoresSeleccionados);
            }
        } catch (error) {
            console.error('Error cargando equipo:', error);
        }
    }
    
    // Obtener presupuesto del backend
    async function actualizarPresupuestoBackend() {
        if (!token) return;
        
        try {
            const response = await fetch('/api/jugadores/presupuesto', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const presupuestoData = await response.json();
                presupuestoActual = presupuestoData.disponible;
                presupuestoElement.textContent = `$${presupuestoActual}M`;
            }
        } catch (error) {
            console.error('Error obteniendo presupuesto:', error);
        }
    }
    
    // Configurar event listeners
    function configurarEventListeners() {
        // Clic en las posiciones de la cancha
        document.querySelectorAll('.posicion').forEach(posicion => {
            posicion.addEventListener('click', function(event) {
                if (event.button === 2) {
                    event.preventDefault();
                    removerJugadorBackend(this.getAttribute('data-pos'));
                } else {
                    abrirModalJugadoresBackend(event);
                }
            });
            
            posicion.addEventListener('contextmenu', function(event) {
                event.preventDefault();
                removerJugadorBackend(this.getAttribute('data-pos'));
            });
        });
        
        closeModal.addEventListener('click', cerrarModal);
        
        window.addEventListener('click', function(event) {
            if (event.target === modal) {
                cerrarModal();
            }
        });
        
        btnComenzar.addEventListener('click', function() {
            // Redirigir a simulación
            window.location.href = '/simulacion';
        });
    }
    
    // Remover jugador usando el backend
    async function removerJugadorBackend(posicion) {
        if (!token) {
            Swal.fire({
                icon: 'error',
                title: 'No autenticado',
                text: 'Debes iniciar sesión para gestionar tu equipo.',
                confirmButtonColor: '#D32F2F'
            });
            return;
        }
        
        if (!jugadoresSeleccionados[posicion]) {
            Swal.fire({
                icon: 'info',
                title: 'Posición vacía',
                text: 'No hay ningún jugador en esta posición para remover.',
                confirmButtonColor: '#45B7D1'
            });
            return;
        }
        
        Swal.fire({
            title: '¿Remover jugador?',
            text: `¿Estás seguro de que quieres remover a ${jugadoresSeleccionados[posicion].nombre}?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#D32F2F',
            cancelButtonColor: '#45B7D1',
            confirmButtonText: 'Sí, remover',
            cancelButtonText: 'Cancelar'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const response = await fetch(`/api/jugadores/remover/${posicion}`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    if (response.ok) {
                        const result = await response.json();
                        delete jugadoresSeleccionados[posicion];
                        
                        resetearPosicionCancha(posicion);
                        await actualizarPresupuestoBackend();
                        await verificarEquipoCompletoBackend();
                        
                        Swal.fire({
                            icon: 'success',
                            title: 'Jugador removido',
                            text: result.mensaje,
                            confirmButtonColor: '#4CAF50'
                        });
                    } else {
                        const error = await response.json();
                        throw new Error(error.error || 'Error al remover jugador');
                    }
                } catch (error) {
                    console.error('Error removiendo jugador:', error);
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: error.message,
                        confirmButtonColor: '#D32F2F'
                    });
                }
            }
        });
    }
    
    // Abrir modal con jugadores del backend
    async function abrirModalJugadoresBackend(event) {
        const posicion = event.currentTarget;
        posicionActual = posicion.getAttribute('data-pos');
        
        try {
            const tipoPosicion = obtenerTipoPosicion(posicionActual);
            const response = await fetch(`/api/jugadores/posicion/${tipoPosicion}`);
            
            if (response.ok) {
                const jugadores = await response.json();
                mostrarJugadoresEnModal(jugadores);
                modal.style.display = 'block';
            } else {
                throw new Error('Error al cargar jugadores');
            }
        } catch (error) {
            console.error('Error cargando jugadores:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudieron cargar los jugadores',
                confirmButtonColor: '#D32F2F'
            });
        }
    }
    
    // Mostrar jugadores en el modal
    function mostrarJugadoresEnModal(jugadoresLista) {
        jugadoresGrid.innerHTML = '';
        
        // Agregar opción para remover jugador si ya hay uno en esta posición
        if (jugadoresSeleccionados[posicionActual]) {
            const removerCard = document.createElement('div');
            removerCard.className = 'jugador-card remover-card';
            removerCard.innerHTML = `
                <div class="jugador-iniciales" style="background-color: #D32F2F;">X</div>
                <div class="jugador-nombre">Remover jugador</div>
                <div class="jugador-info">Elimina al jugador actual</div>
                <div class="jugador-precio">+$${jugadoresSeleccionados[posicionActual].precio}M</div>
            `;
            
            removerCard.addEventListener('click', function() {
                removerJugadorBackend(posicionActual);
                cerrarModal();
            });
            
            jugadoresGrid.appendChild(removerCard);
        }
        
        jugadoresLista.forEach(jugador => {
            const jugadorCard = document.createElement('div');
            jugadorCard.className = 'jugador-card';
            
            const inicialesDiv = document.createElement('div');
            inicialesDiv.className = 'jugador-iniciales';
            inicialesDiv.textContent = jugador.iniciales;
            inicialesDiv.style.backgroundColor = obtenerColorJugador(jugador.id_jugador);
            
            jugadorCard.innerHTML = `
                <div class="jugador-nombre">${jugador.nombre}</div>
                <div class="jugador-info">Velocidad: ${jugador.velocidad}/10</div>
                <div class="jugador-info">Fuerza: ${jugador.fuerza}/10</div>
                <div class="jugador-precio">$${jugador.precio}M</div>
            `;
            
            jugadorCard.insertBefore(inicialesDiv, jugadorCard.firstChild);
            
            jugadorCard.addEventListener('click', function() {
                seleccionarJugadorBackend(jugador);
            });
            
            jugadoresGrid.appendChild(jugadorCard);
        });
    }
    
    // Seleccionar jugador usando el backend
    async function seleccionarJugadorBackend(jugador) {
        if (!token) {
            Swal.fire({
                icon: 'error',
                title: 'No autenticado',
                text: 'Debes iniciar sesión para seleccionar jugadores.',
                confirmButtonColor: '#D32F2F'
            });
            return;
        }
        
        try {
            const response = await fetch('/api/jugadores/seleccionar', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id_jugador: jugador.id_jugador,
                    posicion_cancha: posicionActual
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                
                // Actualizar localmente
                jugadoresSeleccionados[posicionActual] = {
                    id: jugador.id_jugador,
                    nombre: jugador.nombre,
                    posicion: jugador.posicion,
                    precio: jugador.precio,
                    velocidad: jugador.velocidad,
                    fuerza: jugador.fuerza,
                    iniciales: jugador.iniciales
                };
                
                actualizarPosicionCancha(posicionActual, jugadoresSeleccionados[posicionActual]);
                await actualizarPresupuestoBackend();
                await verificarEquipoCompletoBackend();
                cerrarModal();
                
                Swal.fire({
                    icon: 'success',
                    title: 'Jugador seleccionado',
                    text: result.mensaje,
                    confirmButtonColor: '#4CAF50'
                });
                
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Error al seleccionar jugador');
            }
        } catch (error) {
            console.error('Error seleccionando jugador:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message,
                confirmButtonColor: '#D32F2F'
            });
        }
    }
    
    // Verificar equipo completo con backend
    async function verificarEquipoCompletoBackend() {
        if (!token) return;
        
        try {
            const response = await fetch('/api/jugadores/verificar-completo', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                btnComenzar.disabled = !data.completo;
            }
        } catch (error) {
            console.error('Error verificando equipo:', error);
        }
    }
    
    // Funciones auxiliares (sin cambios)
    function resetearPosicionCancha(posicion) {
        const elementoPosicion = document.querySelector(`.posicion[data-pos="${posicion}"]`);
        elementoPosicion.textContent = obtenerTextoPosicion(posicion);
        elementoPosicion.classList.add('vacia');
        elementoPosicion.style.backgroundColor = '';
        elementoPosicion.style.color = '';
    }
    
    function obtenerTextoPosicion(posicion) {
        if (posicion === 'portero') return 'P';
        if (posicion.includes('defensa')) return 'DF';
        if (posicion.includes('mediocampo')) return 'MC';
        if (posicion.includes('delantero')) return 'DL';
        return '';
    }
    
    function obtenerTipoPosicion(pos) {
        if (pos === 'portero') return 'portero';
        if (pos.includes('defensa')) return 'defensa';
        if (pos.includes('mediocampo')) return 'mediocampo';
        if (pos.includes('delantero')) return 'delantero';
        return '';
    }
    
    function obtenerColorJugador(id) {
        return colores[id % colores.length];
    }
    
    function actualizarPosicionCancha(posicion, jugador) {
        const elementoPosicion = document.querySelector(`.posicion[data-pos="${posicion}"]`);
        elementoPosicion.textContent = jugador.nombre.split(' ')[0];
        elementoPosicion.classList.remove('vacia');
        elementoPosicion.style.backgroundColor = obtenerColorJugador(jugador.id);
        elementoPosicion.style.color = 'white';
    }
    
    function cerrarModal() {
        modal.style.display = 'none';
    }
    
    // Inicializar la página
    inicializar();
});