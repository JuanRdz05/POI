// simulacion.js - Versión completa con estadísticas
document.addEventListener('DOMContentLoaded', function() {
    const paisDisplay = document.getElementById('pais-display');
    const btnSimular = document.getElementById('btn-simular');
    const diagramaTorneo = document.getElementById('diagrama-torneo');
    const ganadorTorneo = document.getElementById('ganador-torneo');
    const infoGanador = document.getElementById('info-ganador');
    
    const banderasPaises = {
        'Argentina': '🇦🇷', 'Brasil': '🇧🇷', 'Alemania': '🇩🇪',
        'Francia': '🇫🇷', 'España': '🇪🇸', 'Italia': '🇮🇹',
        'Inglaterra': '🇬🇧', 'Portugal': '🇵🇹', 'Bélgica': '🇧🇪',
        'Holanda': '🇳🇱', 'Uruguay': '🇺🇾', 'Croacia': '🇭🇷',
        'Colombia': '🇨🇴', 'México': '🇲🇽', 'Japón': '🇯🇵',
        'Senegal': '🇸🇳', 'Canada': '🇨🇦', 'Estados Unidos': '🇺🇸',
        'Australia': '🇦🇺', 'Corea del Sur': '🇰🇷', 'Dinamarca': '🇩🇰',
        'Marruecos': '🇲🇦'
    };
    
    let paisUsuario = null;
    let equiposTorneo = [];
    let simulacionEnCurso = false;
    let timeoutIds = [];
    let puntosUsuario = 50;
    let torneoActualId = null;
    let posicionFinalUsuario = null;
    let rachaMaximaUsuario = 0;
    let usuarioEliminado = false;
    
    // ====================================
    // SISTEMA DE SIMULACIÓN
    // ====================================
    
    function simularPartidoMejorado(equipo1, equipo2, fase) {
        const momentum1 = calcularMomentum(equipo1);
        const momentum2 = calcularMomentum(equipo2);
        const presion = calcularFactorPresion(fase);
        const puntosAjustados1 = ajustarPuntos(equipo1.puntos, momentum1, presion);
        const puntosAjustados2 = ajustarPuntos(equipo2.puntos, momentum2, presion);
        const resultado = simularPartidoCompleto(equipo1, equipo2, puntosAjustados1, puntosAjustados2);
        
        resultado.ganador.racha = (resultado.ganador.racha || 0) + 1;
        resultado.perdedor.racha = 0;
        
        if (resultado.ganador.id === paisUsuario?.id_pais) {
            rachaMaximaUsuario = Math.max(rachaMaximaUsuario, resultado.ganador.racha);
        }
        
        if (!usuarioEliminado && resultado.perdedor.id === paisUsuario?.id_pais) {
            usuarioEliminado = true;
            posicionFinalUsuario = obtenerPosicionPorFase(fase);
            console.log(`❌ Usuario eliminado en ${fase}. Posición: ${posicionFinalUsuario}`);
        }
        
        return {
            equipo1: equipo1,
            equipo2: equipo2,
            ganador: resultado.ganador,
            goles1: resultado.goles1,
            goles2: resultado.goles2,
            penales: resultado.penales,
            dramatico: resultado.dramatico
        };
    }
    
    function obtenerPosicionPorFase(fase) {
        const posiciones = {
            'octavos': 'Octavos de Final',
            'cuartos': 'Cuartos de Final',
            'semifinal': 'Semifinal',
            'final': 'Subcampeón'
        };
        return posiciones[fase] || 'Participante';
    }
    
    function calcularMomentum(equipo) {
        const racha = equipo.racha || 0;
        return Math.min(racha * 0.05, 0.20);
    }
    
    function calcularFactorPresion(fase) {
        const factores = {
            'octavos': 1.0,
            'cuartos': 1.05,
            'semifinal': 1.10,
            'final': 1.15
        };
        return factores[fase] || 1.0;
    }
    
    function ajustarPuntos(puntosBase, momentum, presion) {
        let puntosConMomentum = puntosBase * (1 + momentum);
        const variabilidadPresion = (Math.random() - 0.5) * presion * 0.2;
        let puntosFinales = puntosConMomentum * (1 + variabilidadPresion);
        const factorAleatorio = 0.85 + (Math.random() * 0.30);
        puntosFinales *= factorAleatorio;
        return Math.max(puntosFinales, 20);
    }
    
    function simularPartidoCompleto(equipo1, equipo2, puntos1, puntos2) {
        const totalPuntos = puntos1 + puntos2;
        const prob1 = puntos1 / totalPuntos;
        
        let goles1 = simularGoles(prob1, equipo1.puntos);
        let goles2 = simularGoles(1 - prob1, equipo2.puntos);
        
        let penales = false;
        let dramatico = false;
        
        if (goles1 === goles2) {
            dramatico = true;
            const golesExtra1 = Math.random() < (prob1 * 0.3) ? 1 : 0;
            const golesExtra2 = Math.random() < ((1 - prob1) * 0.3) ? 1 : 0;
            
            goles1 += golesExtra1;
            goles2 += golesExtra2;
            
            if (goles1 === goles2) {
                penales = true;
                const ganadorPenales = Math.random() < (prob1 * 0.9) ? equipo1 : equipo2;
                
                return {
                    ganador: ganadorPenales,
                    perdedor: ganadorPenales === equipo1 ? equipo2 : equipo1,
                    goles1: goles1,
                    goles2: goles2,
                    penales: true,
                    dramatico: true
                };
            }
        }
        
        const ganador = goles1 > goles2 ? equipo1 : equipo2;
        const perdedor = goles1 > goles2 ? equipo2 : equipo1;
        
        if (Math.abs(goles1 - goles2) === 1) {
            dramatico = true;
        }
        
        return {
            ganador: ganador,
            perdedor: perdedor,
            goles1: goles1,
            goles2: goles2,
            penales: penales,
            dramatico: dramatico
        };
    }
    
    function simularGoles(probabilidad, puntos) {
        const oportunidades = Math.floor(3 + (puntos / 50));
        let goles = 0;
        
        for (let i = 0; i < oportunidades; i++) {
            const probabilidadGol = probabilidad * 0.25;
            if (Math.random() < probabilidadGol) {
                goles++;
            }
        }
        
        return Math.min(goles, 7);
    }
    
    // ====================================
    // INICIALIZACIÓN
    // ====================================
    
    async function inicializar() {
        try {
            console.log('🚀 Iniciando simulación...');
            const tokenEncontrado = await esperarToken();
            
            if (!tokenEncontrado) {
                mostrarSinSesion();
                return;
            }
            
            await cargarPaisUsuario();
            configurarEventListeners();
        } catch (error) {
            console.error('❌ Error inicializando:', error);
            mostrarError('Error al inicializar la página');
        }
    }
    
    function esperarToken() {
        return new Promise((resolve) => {
            let intentos = 0;
            const maxIntentos = 50;
            
            const checkToken = setInterval(() => {
                const token = localStorage.getItem('authToken');
                intentos++;
                
                if (token) {
                    clearInterval(checkToken);
                    resolve(true);
                } else if (intentos >= maxIntentos) {
                    clearInterval(checkToken);
                    resolve(false);
                }
            }, 100);
        });
    }
    
    async function cargarPaisUsuario() {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) {
                mostrarSinSesion();
                return;
            }
            
            const response = await fetch('/api/simulacion/pais-usuario', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    mostrarSinSesion();
                    return;
                }
                
                const errorData = await response.json();
                if (response.status === 400 && errorData.mensaje) {
                    mostrarSinPais(errorData.mensaje);
                    return;
                }
                
                throw new Error('Error al obtener país');
            }
            
            const data = await response.json();
            paisUsuario = data;
            
            await cargarPuntosEquipo();
            mostrarPaisUsuario();
            btnSimular.style.display = 'block';
            
        } catch (error) {
            console.error('❌ Error cargando país:', error);
            mostrarError('No se pudo cargar tu país. Por favor recarga la página.');
        }
    }
    
    async function cargarPuntosEquipo() {
        try {
            const token = localStorage.getItem('authToken');
            
            const response = await fetch('/api/simulacion/calcular-puntos', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                puntosUsuario = data.puntos;
            }
        } catch (error) {
            console.error('❌ Error cargando puntos:', error);
        }
    }
    
    function mostrarPaisUsuario() {
        const bandera = banderasPaises[paisUsuario.nombre] || '🌍';
        
        paisDisplay.innerHTML = `
            <div class="pais-usuario-card">
                <div class="pais-bandera">${bandera}</div>
                <div class="pais-nombre">${paisUsuario.nombre}</div>
                <div class="pais-info">
                    <i class="fas fa-trophy"></i> 
                    Fuerza del equipo: ${puntosUsuario} puntos
                </div>
            </div>
        `;
    }
    
    function mostrarSinPais(mensaje) {
        paisDisplay.innerHTML = `
            <div class="sin-pais">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>No tienes un país seleccionado</h3>
                <p>${mensaje || 'Para participar en el torneo, primero debes seleccionar un país en tu perfil.'}</p>
                <button class="btn-ir-perfil" onclick="window.location.href='/perfil'">
                    <i class="fas fa-user"></i> Ir a mi perfil
                </button>
            </div>
        `;
    }
    
    function mostrarSinSesion() {
        paisDisplay.innerHTML = `
            <div class="sin-pais">
                <i class="fas fa-sign-in-alt"></i>
                <h3>Debes iniciar sesión</h3>
                <p>Para participar en el torneo, primero debes iniciar sesión.</p>
                <button class="btn-ir-perfil" onclick="window.location.href='/login'">
                    <i class="fas fa-sign-in-alt"></i> Iniciar Sesión
                </button>
            </div>
        `;
    }
    
    function mostrarError(mensaje) {
        paisDisplay.innerHTML = `
            <div class="sin-pais">
                <i class="fas fa-times-circle"></i>
                <h3>Error</h3>
                <p>${mensaje}</p>
                <button class="btn-ir-perfil" onclick="location.reload()">
                    <i class="fas fa-redo"></i> Reintentar
                </button>
            </div>
        `;
    }
    
    function configurarEventListeners() {
        btnSimular.addEventListener('click', simularTorneo);
        
        window.addEventListener('beforeunload', function(e) {
            if (simulacionEnCurso) {
                e.preventDefault();
                e.returnValue = '¿Estás seguro de que quieres salir durante la simulación?';
                return e.returnValue;
            }
        });
    }
    
    // ====================================
    // SIMULACIÓN DEL TORNEO
    // ====================================
    
    async function simularTorneo() {
        if (!paisUsuario) {
            Swal.fire({
                icon: 'error',
                title: 'Sin país',
                text: 'Necesitas tener un país seleccionado para simular el torneo.',
                confirmButtonColor: '#D32F2F'
            });
            return;
        }
        
        if (simulacionEnCurso) {
            Swal.fire({
                icon: 'info',
                title: 'Simulación en curso',
                text: 'Ya hay una simulación en proceso.',
                confirmButtonColor: '#45B7D1'
            });
            return;
        }
        
        try {
            posicionFinalUsuario = null;
            rachaMaximaUsuario = 0;
            usuarioEliminado = false;
            
            const token = localStorage.getItem('authToken');
            const torneoResponse = await fetch('/api/estadisticas/iniciar-torneo', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!torneoResponse.ok) {
                throw new Error('Error al iniciar torneo');
            }
            
            const torneoData = await torneoResponse.json();
            torneoActualId = torneoData.id_torneo;
            console.log('🏆 Torneo iniciado con ID:', torneoActualId);
            
            const response = await fetch('/api/simulacion/paises-torneo');
            const paisesData = await response.json();
            
            equiposTorneo = paisesData.map(pais => ({
                id: pais.id,
                nombre: pais.nombre,
                bandera: banderasPaises[pais.nombre] || '🌍',
                puntos: pais.puntos || 50,
                racha: 0
            }));
            
            const indexUsuario = equiposTorneo.findIndex(p => p.id === paisUsuario.id_pais);
            if (indexUsuario !== -1) {
                equiposTorneo[indexUsuario].puntos = puntosUsuario;
            }
            
            if (equiposTorneo.length < 16) {
                Swal.fire({
                    icon: 'error',
                    title: 'Equipos insuficientes',
                    text: 'Se necesitan al menos 16 países para el torneo.',
                    confirmButtonColor: '#D32F2F'
                });
                return;
            }
            
            equiposTorneo = equiposTorneo.slice(0, 16);
            iniciarSimulacion();
            
        } catch (error) {
            console.error('Error cargando países:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudieron cargar los países del torneo.',
                confirmButtonColor: '#D32F2F'
            });
        }
    }
    
    function iniciarSimulacion() {
        simulacionEnCurso = true;
        btnSimular.disabled = true;
        btnSimular.textContent = 'Simulando...';
        limpiarTimeouts();
        
        diagramaTorneo.innerHTML = '<h2>Diagrama del Torneo</h2>';
        ganadorTorneo.style.display = 'none';
        
        const bracketContainer = document.createElement('div');
        bracketContainer.className = 'bracket-container';
        diagramaTorneo.appendChild(bracketContainer);
        
        shuffleArray(equiposTorneo);
        simularFase('octavos', 8);
    }
    
    function simularFase(fase, cantidadPartidos) {
        const timeoutId = setTimeout(() => {
            let bracketContainer = document.querySelector('.bracket-container');
            if (!bracketContainer) {
                bracketContainer = document.createElement('div');
                bracketContainer.className = 'bracket-container';
                diagramaTorneo.appendChild(bracketContainer);
            }
            
            const faseDiv = document.createElement('div');
            faseDiv.className = 'fase';
            faseDiv.innerHTML = `<h3>${fase.charAt(0).toUpperCase() + fase.slice(1)} de Final</h3>`;
            
            const partidosContainer = document.createElement('div');
            partidosContainer.className = 'partidos-container';
            faseDiv.appendChild(partidosContainer);
            
            const partidos = [];
            
            for (let i = 0; i < cantidadPartidos; i++) {
                const equipo1 = equiposTorneo[i * 2];
                const equipo2 = equiposTorneo[i * 2 + 1];
                
                const partido = simularPartidoMejorado(equipo1, equipo2, fase);
                partidos.push(partido);
                
                if (equipo1.id === paisUsuario.id_pais || equipo2.id === paisUsuario.id_pais) {
                    guardarPartido(partido, fase);
                }
                
                const partidoDiv = crearPartidoHTML(partido, fase);
                partidosContainer.appendChild(partidoDiv);
            }
            
            bracketContainer.appendChild(faseDiv);
            setTimeout(crearConexiones, 100);
            
            equiposTorneo = partidos.map(p => p.ganador);
            
            if (fase === 'octavos') {
                timeoutIds.push(setTimeout(() => simularFase('cuartos', 4), 2000));
            } else if (fase === 'cuartos') {
                timeoutIds.push(setTimeout(() => simularFase('semifinal', 2), 2000));
            } else if (fase === 'semifinal') {
                timeoutIds.push(setTimeout(() => simularFase('final', 1), 2000));
            } else if (fase === 'final') {
                timeoutIds.push(setTimeout(() => finalizarTorneo(), 2000));
            }
        }, 1000);
        
        timeoutIds.push(timeoutId);
    }
    
    async function guardarPartido(partido, fase) {
        try {
            const token = localStorage.getItem('authToken');
            if (!token || !torneoActualId) return;
            
            const esUsuarioEquipo1 = partido.equipo1.id === paisUsuario.id_pais;
            const esGanador = partido.ganador.id === paisUsuario.id_pais;
            const oponente = esUsuarioEquipo1 ? partido.equipo2 : partido.equipo1;
            
            const golesUsuario = esUsuarioEquipo1 ? partido.goles1 : partido.goles2;
            const golesOponente = esUsuarioEquipo1 ? partido.goles2 : partido.goles1;
            
            const response = await fetch('/api/estadisticas/guardar-partido', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id_torneo: torneoActualId,
                    id_pais_oponente: oponente.id,
                    resultado: esGanador ? 'ganado' : 'perdido',
                    fase: fase,
                    goles_usuario: golesUsuario,
                    goles_oponente: golesOponente,
                    fue_penales: partido.penales,
                    fue_dramatico: partido.dramatico,
                    puntos_equipo: puntosUsuario,
                    puntos_oponente: oponente.puntos
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Partido guardado:', data);
            }
        } catch (error) {
            console.error('❌ Error guardando partido:', error);
        }
    }
    
    function crearPartidoHTML(partido, fase) {
        const partidoDiv = document.createElement('div');
        partidoDiv.className = 'partido';
        
        if (partido.equipo1.id === paisUsuario?.id_pais || 
            partido.equipo2.id === paisUsuario?.id_pais) {
            partidoDiv.classList.add('equipo-usuario');
        }
        
        if (partido.ganador.id === paisUsuario?.id_pais) {
            partidoDiv.classList.add('ganador');
        }
        
        if (partido.dramatico) {
            partidoDiv.classList.add('partido-dramatico');
        }
        
        const equipo1Class = partido.equipo1.id === partido.ganador.id ? 'ganador' : '';
        const equipo2Class = partido.equipo2.id === partido.ganador.id ? 'ganador' : '';
        
        const marcador = partido.penales ? 
            `<div class="marcador">${partido.goles1} - ${partido.goles2} <span class="penales">(Penales)</span></div>` :
            `<div class="marcador">${partido.goles1} - ${partido.goles2}</div>`;
        
        const momentum1 = partido.equipo1.racha > 0 ? `<span class="momentum">🔥 ${partido.equipo1.racha}</span>` : '';
        const momentum2 = partido.equipo2.racha > 0 ? `<span class="momentum">🔥 ${partido.equipo2.racha}</span>` : '';
        
        partidoDiv.innerHTML = `
            <div class="equipos-partido">
                <div class="equipo ${equipo1Class}">
                    <span>${partido.equipo1.bandera} ${partido.equipo1.nombre}</span>
                    ${momentum1}
                </div>
                <div class="vs">VS</div>
                <div class="equipo ${equipo2Class}">
                    <span>${partido.equipo2.bandera} ${partido.equipo2.nombre}</span>
                    ${momentum2}
                </div>
            </div>
            ${marcador}
            <div class="ganador-partido">
                ${partido.dramatico ? '⚡ ' : ''}Ganador: ${partido.ganador.bandera} ${partido.ganador.nombre}
            </div>
        `;
        
        return partidoDiv;
    }
    
    function crearConexiones() {
        const fases = document.querySelectorAll('.fase');
        document.querySelectorAll('.conexion').forEach(el => el.remove());
        
        for (let i = 0; i < fases.length - 1; i++) {
            const partidosFaseActual = fases[i].querySelectorAll('.partido');
            const partidosFaseSiguiente = fases[i + 1].querySelectorAll('.partido');
            
            for (let j = 0; j < partidosFaseSiguiente.length; j++) {
                const partidoSiguiente = partidosFaseSiguiente[j];
                const partidoActual1 = partidosFaseActual[j * 2];
                const partidoActual2 = partidosFaseActual[j * 2 + 1];
                
                if (partidoActual1 && partidoActual2 && partidoSiguiente) {
                    crearConexion(partidoActual1, partidoSiguiente);
                    crearConexion(partidoActual2, partidoSiguiente);
                }
            }
        }
    }
    
    function crearConexion(partidoOrigen, partidoDestino) {
        const contenedor = document.querySelector('.bracket-container');
        const rectOrigen = partidoOrigen.getBoundingClientRect();
        const rectDestino = partidoDestino.getBoundingClientRect();
        const contenedorRect = contenedor.getBoundingClientRect();
        
        const origenX = rectOrigen.right - contenedorRect.left;
        const origenY = rectOrigen.top + rectOrigen.height / 2 - contenedorRect.top;
        const destinoX = rectDestino.left - contenedorRect.left;
        const destinoY = rectDestino.top + rectDestino.height / 2 - contenedorRect.top;
        
        const lineaHorizontal = document.createElement('div');
        lineaHorizontal.className = 'conexion conexion-horizontal';
        lineaHorizontal.style.width = `${destinoX - origenX}px`;
        lineaHorizontal.style.height = '2px';
        lineaHorizontal.style.left = `${origenX}px`;
        lineaHorizontal.style.top = `${origenY}px`;
        contenedor.appendChild(lineaHorizontal);
        
        if (Math.abs(origenY - destinoY) > 1) {
            const lineaVertical = document.createElement('div');
            lineaVertical.className = 'conexion conexion-vertical';
            lineaVertical.style.width = '2px';
            lineaVertical.style.height = `${Math.abs(destinoY - origenY)}px`;
            lineaVertical.style.left = `${destinoX}px`;
            lineaVertical.style.top = `${Math.min(origenY, destinoY)}px`;
            contenedor.appendChild(lineaVertical);
        }
    }
    
    async function finalizarTorneo() {
        const campeon = equiposTorneo[0];
        
        if (campeon.id === paisUsuario?.id_pais) {
            posicionFinalUsuario = 'Campeón';
        }
        
        try {
            const token = localStorage.getItem('authToken');
            
            const response = await fetch('/api/estadisticas/finalizar-torneo', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id_torneo: torneoActualId,
                    posicion_final: posicionFinalUsuario || 'Participante',
                    campeon: campeon.nombre,
                    racha_maxima: rachaMaximaUsuario
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Torneo finalizado:', data);
            } else {
                console.error('❌ Error finalizando torneo');
            }
        } catch (error) {
            console.error('❌ Error en finalizar torneo:', error);
        }
        
        ganadorTorneo.style.display = 'block';
        infoGanador.innerHTML = `${campeon.bandera} ${campeon.nombre}`;
        
        simulacionEnCurso = false;
        btnSimular.disabled = false;
        btnSimular.textContent = 'Simular Torneo';
        
        if (campeon.id === paisUsuario?.id_pais) {
            Swal.fire({
                icon: 'success',
                title: '¡Campeones del Mundo! 🏆',
                html: `<p>¡Felicidades! <strong>${campeon.nombre}</strong> ha ganado el Mundial.</p>
                       <p>Racha máxima: ${rachaMaximaUsuario} victorias</p>`,
                confirmButtonColor: '#4CAF50'
            });
        } else {
            Swal.fire({
                icon: 'info',
                title: 'Fin del torneo',
                html: `<p>Tu equipo fue eliminado en: <strong>${posicionFinalUsuario}</strong></p>
                       <p>Campeón: <strong>${campeon.bandera} ${campeon.nombre}</strong></p>
                       <p>Racha máxima: ${rachaMaximaUsuario} victorias</p>`,
                confirmButtonColor: '#45B7D1'
            });
        }
    }
    
    function limpiarTimeouts() {
        timeoutIds.forEach(id => clearTimeout(id));
        timeoutIds = [];
    }
    
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
    
    inicializar();
});