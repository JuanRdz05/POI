// BACKEND - DATABASE/SRC/ROUTES/jugadores.js
const express = require('express');
const router = express.Router();
const { promisePool } = require('../CONFIG/database');
const authenticateToken = require('../MIDDLEWARE/auth');

// ====================================
// OBTENER TODOS LOS JUGADORES
// ====================================
router.get('/todos', async (req, res) => {
    try {
        console.log('⚽ Obteniendo todos los jugadores');

        const [jugadores] = await promisePool.query(
            `SELECT id_jugador, nombre, posicion, precio, velocidad, fuerza, iniciales 
             FROM jugadores 
             ORDER BY FIELD(posicion, 'portero', 'defensa', 'mediocampo', 'delantero'), precio DESC`
        );

        console.log(`✅ Jugadores obtenidos: ${jugadores.length}`);
        res.json(jugadores);

    } catch (error) {
        console.error('❌ Error obteniendo jugadores:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            details: error.message 
        });
    }
});

// ====================================
// OBTENER JUGADORES POR POSICIÓN
// ====================================
router.get('/posicion/:posicion', async (req, res) => {
    try {
        const { posicion } = req.params;
        console.log('🎯 Obteniendo jugadores de posición:', posicion);

        const [jugadores] = await promisePool.query(
            `SELECT id_jugador, nombre, posicion, precio, velocidad, fuerza, iniciales 
             FROM jugadores 
             WHERE posicion = ? 
             ORDER BY precio DESC`,
            [posicion]
        );

        console.log(`✅ Jugadores encontrados: ${jugadores.length}`);
        res.json(jugadores);

    } catch (error) {
        console.error('❌ Error obteniendo jugadores por posición:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            details: error.message 
        });
    }
});

// ====================================
// OBTENER EQUIPO DEL USUARIO
// ====================================
router.get('/equipo', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log('👥 Obteniendo equipo del usuario:', userId);

        const [equipo] = await promisePool.query(
            `SELECT 
                eu.id_equipo,
                eu.posicion_cancha,
                j.id_jugador,
                j.nombre,
                j.posicion,
                j.precio,
                j.velocidad,
                j.fuerza,
                j.iniciales
             FROM equipo_usuario eu
             INNER JOIN jugadores j ON eu.id_jugador = j.id_jugador
             WHERE eu.id_usuario = ?`,
            [userId]
        );

        console.log(`✅ Jugadores en el equipo: ${equipo.length}`);
        res.json(equipo);

    } catch (error) {
        console.error('❌ Error obteniendo equipo:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            details: error.message 
        });
    }
});

// ====================================
// CALCULAR PRESUPUESTO DISPONIBLE
// ====================================
router.get('/presupuesto', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log('💰 Calculando presupuesto del usuario:', userId);

        const presupuestoTotal = 200; // 200 millones

        // Calcular presupuesto gastado
        const [gastado] = await promisePool.query(
            `SELECT COALESCE(SUM(j.precio), 0) as total_gastado
             FROM equipo_usuario eu
             INNER JOIN jugadores j ON eu.id_jugador = j.id_jugador
             WHERE eu.id_usuario = ?`,
            [userId]
        );

        const presupuestoGastado = gastado[0].total_gastado;
        const presupuestoDisponible = presupuestoTotal - presupuestoGastado;

        console.log(`✅ Presupuesto: ${presupuestoDisponible}M disponible de ${presupuestoTotal}M`);
        
        res.json({
            total: presupuestoTotal,
            gastado: presupuestoGastado,
            disponible: presupuestoDisponible
        });

    } catch (error) {
        console.error('❌ Error calculando presupuesto:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            details: error.message 
        });
    }
});

// ====================================
// SELECCIONAR JUGADOR PARA EL EQUIPO
// ====================================
router.post('/seleccionar', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id_jugador, posicion_cancha } = req.body;

        console.log('➕ Seleccionando jugador:', { userId, id_jugador, posicion_cancha });

        // Validar datos
        if (!id_jugador || !posicion_cancha) {
            return res.status(400).json({ 
                error: 'Faltan datos requeridos' 
            });
        }

        // Verificar que el jugador existe
        const [jugador] = await promisePool.query(
            'SELECT id_jugador, nombre, precio, posicion FROM jugadores WHERE id_jugador = ?',
            [id_jugador]
        );

        if (jugador.length === 0) {
            return res.status(404).json({ 
                error: 'Jugador no encontrado' 
            });
        }

        const jugadorData = jugador[0];

        // Verificar presupuesto disponible
        const presupuestoTotal = 200;
        const [gastado] = await promisePool.query(
            `SELECT COALESCE(SUM(j.precio), 0) as total_gastado
             FROM equipo_usuario eu
             INNER JOIN jugadores j ON eu.id_jugador = j.id_jugador
             WHERE eu.id_usuario = ? AND eu.posicion_cancha != ?`,
            [userId, posicion_cancha]
        );

        const presupuestoDisponible = presupuestoTotal - gastado[0].total_gastado;

        if (jugadorData.precio > presupuestoDisponible) {
            return res.status(400).json({ 
                error: 'Presupuesto insuficiente',
                presupuesto_disponible: presupuestoDisponible,
                precio_jugador: jugadorData.precio
            });
        }

        // Verificar si el jugador ya está en otra posición
        const [jugadorEnEquipo] = await promisePool.query(
            `SELECT posicion_cancha FROM equipo_usuario 
             WHERE id_usuario = ? AND id_jugador = ? AND posicion_cancha != ?`,
            [userId, id_jugador, posicion_cancha]
        );

        if (jugadorEnEquipo.length > 0) {
            return res.status(400).json({ 
                error: 'Este jugador ya está en tu equipo',
                posicion_actual: jugadorEnEquipo[0].posicion_cancha
            });
        }

        // Verificar si ya hay un jugador en esa posición
        const [posicionOcupada] = await promisePool.query(
            'SELECT id_equipo, id_jugador FROM equipo_usuario WHERE id_usuario = ? AND posicion_cancha = ?',
            [userId, posicion_cancha]
        );

        if (posicionOcupada.length > 0) {
            // Reemplazar jugador existente
            await promisePool.query(
                'UPDATE equipo_usuario SET id_jugador = ? WHERE id_usuario = ? AND posicion_cancha = ?',
                [id_jugador, userId, posicion_cancha]
            );
            console.log('🔄 Jugador reemplazado en posición:', posicion_cancha);
        } else {
            // Insertar nuevo jugador
            await promisePool.query(
                'INSERT INTO equipo_usuario (id_usuario, id_jugador, posicion_cancha) VALUES (?, ?, ?)',
                [userId, id_jugador, posicion_cancha]
            );
            console.log('✅ Jugador agregado a posición:', posicion_cancha);
        }

        // Calcular nuevo presupuesto
        const [nuevoGastado] = await promisePool.query(
            `SELECT COALESCE(SUM(j.precio), 0) as total_gastado
             FROM equipo_usuario eu
             INNER JOIN jugadores j ON eu.id_jugador = j.id_jugador
             WHERE eu.id_usuario = ?`,
            [userId]
        );

        const nuevoPresupuestoDisponible = presupuestoTotal - nuevoGastado[0].total_gastado;

        res.json({ 
            success: true,
            mensaje: 'Jugador seleccionado correctamente',
            jugador: jugadorData,
            presupuesto_disponible: nuevoPresupuestoDisponible
        });

    } catch (error) {
        console.error('❌ Error seleccionando jugador:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            details: error.message 
        });
    }
});

// ====================================
// REMOVER JUGADOR DEL EQUIPO
// ====================================
router.delete('/remover/:posicion_cancha', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { posicion_cancha } = req.params;

        console.log('➖ Removiendo jugador:', { userId, posicion_cancha });

        // Verificar que existe un jugador en esa posición
        const [jugadorActual] = await promisePool.query(
            `SELECT eu.id_equipo, j.nombre, j.precio
             FROM equipo_usuario eu
             INNER JOIN jugadores j ON eu.id_jugador = j.id_jugador
             WHERE eu.id_usuario = ? AND eu.posicion_cancha = ?`,
            [userId, posicion_cancha]
        );

        if (jugadorActual.length === 0) {
            return res.status(404).json({ 
                error: 'No hay jugador en esa posición' 
            });
        }

        // Eliminar jugador
        await promisePool.query(
            'DELETE FROM equipo_usuario WHERE id_usuario = ? AND posicion_cancha = ?',
            [userId, posicion_cancha]
        );

        // Calcular nuevo presupuesto
        const presupuestoTotal = 200;
        const [gastado] = await promisePool.query(
            `SELECT COALESCE(SUM(j.precio), 0) as total_gastado
             FROM equipo_usuario eu
             INNER JOIN jugadores j ON eu.id_jugador = j.id_jugador
             WHERE eu.id_usuario = ?`,
            [userId]
        );

        const presupuestoDisponible = presupuestoTotal - gastado[0].total_gastado;

        console.log('✅ Jugador removido:', jugadorActual[0].nombre);
        
        res.json({ 
            success: true,
            mensaje: 'Jugador removido correctamente',
            jugador_removido: jugadorActual[0].nombre,
            presupuesto_disponible: presupuestoDisponible
        });

    } catch (error) {
        console.error('❌ Error removiendo jugador:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            details: error.message 
        });
    }
});

// ====================================
// VERIFICAR SI EL EQUIPO ESTÁ COMPLETO
// ====================================
router.get('/verificar-completo', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const [count] = await promisePool.query(
            'SELECT COUNT(*) as total FROM equipo_usuario WHERE id_usuario = ?',
            [userId]
        );

        const equipoCompleto = count[0].total === 11;

        res.json({ 
            completo: equipoCompleto,
            jugadores_seleccionados: count[0].total,
            jugadores_faltantes: 11 - count[0].total
        });

    } catch (error) {
        console.error('❌ Error verificando equipo:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            details: error.message 
        });
    }
});

module.exports = router;