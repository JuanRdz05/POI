// ROUTES/simulacion.js
const express = require('express');
const router = express.Router();
const { promisePool } = require('../CONFIG/database');
const authenticateToken = require('../MIDDLEWARE/auth');

// ====================================
// OBTENER PAÍS DEL USUARIO
// ====================================
router.get('/pais-usuario', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log('🌎 Obteniendo país del usuario:', userId);

        const [users] = await promisePool.query(
            `SELECT u.id_pais, p.nombre as pais_nombre 
             FROM usuarios u 
             LEFT JOIN pais p ON u.id_pais = p.id 
             WHERE u.id_usuario = ?`,
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const user = users[0];

        if (!user.id_pais) {
            return res.status(400).json({ 
                error: 'No tienes un país seleccionado',
                mensaje: 'Por favor selecciona un país en tu perfil antes de simular un torneo'
            });
        }

        console.log('✅ País del usuario:', user.pais_nombre);
        res.json({
            id_pais: user.id_pais,
            nombre: user.pais_nombre
        });

    } catch (error) {
        console.error('❌ Error obteniendo país:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            details: error.message 
        });
    }
});

// ====================================
// CALCULAR PUNTOS DEL EQUIPO DEL USUARIO
// ====================================
router.get('/calcular-puntos', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log('📊 Calculando puntos del equipo:', userId);

        // Obtener todos los jugadores del equipo del usuario
        const [jugadores] = await promisePool.query(
            `SELECT j.velocidad, j.fuerza 
             FROM equipo_usuario eu 
             INNER JOIN jugadores j ON eu.id_jugador = j.id_jugador 
             WHERE eu.id_usuario = ?`,
            [userId]
        );

        if (jugadores.length === 0) {
            return res.json({ 
                puntos: 50, // Puntos base si no tiene equipo
                mensaje: 'No tienes jugadores seleccionados, se usarán puntos base'
            });
        }

        // Calcular puntos totales (velocidad + fuerza de todos los jugadores)
        let puntosTotal = 0;
        jugadores.forEach(jugador => {
            puntosTotal += jugador.velocidad + jugador.fuerza;
        });

        // Opcional: Agregar puntos base del país si existen
        const [paisData] = await promisePool.query(
            `SELECT p.puntos 
             FROM usuarios u 
             INNER JOIN pais p ON u.id_pais = p.id 
             WHERE u.id_usuario = ?`,
            [userId]
        );

        if (paisData.length > 0) {
            puntosTotal += paisData[0].puntos;
        }

        console.log('✅ Puntos calculados:', puntosTotal);
        res.json({ 
            puntos: puntosTotal,
            jugadores_count: jugadores.length
        });

    } catch (error) {
        console.error('❌ Error calculando puntos:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            details: error.message 
        });
    }
});

// ====================================
// OBTENER TODOS LOS PAÍSES PARA SIMULACIÓN
// ====================================
router.get('/paises-torneo', async (req, res) => {
    try {
        console.log('🏆 Obteniendo países para el torneo');

        const [paises] = await promisePool.query(
            'SELECT id, nombre, puntos FROM pais ORDER BY nombre'
        );

        console.log(`✅ Países obtenidos: ${paises.length}`);
        res.json(paises);

    } catch (error) {
        console.error('❌ Error obteniendo países:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            details: error.message 
        });
    }
});

// ====================================
// GUARDAR RESULTADO DE PARTIDO
// ====================================
router.post('/guardar-partido', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { 
            id_pais_oponente, 
            resultado, 
            fase, 
            puntos_equipo, 
            puntos_oponente 
        } = req.body;

        console.log('💾 Guardando partido:', {
            userId,
            fase,
            resultado
        });

        // Validar datos
        if (!id_pais_oponente || !resultado || !fase || 
            puntos_equipo === undefined || puntos_oponente === undefined) {
            return res.status(400).json({ 
                error: 'Datos incompletos para guardar el partido' 
            });
        }

        // Obtener el país del usuario
        const [userData] = await promisePool.query(
            'SELECT id_pais FROM usuarios WHERE id_usuario = ?',
            [userId]
        );

        if (userData.length === 0 || !userData[0].id_pais) {
            return res.status(400).json({ 
                error: 'El usuario no tiene país asignado' 
            });
        }

        const id_pais_usuario = userData[0].id_pais;

        // Insertar partido
        const [result] = await promisePool.query(
            `INSERT INTO partidos 
             (id_usuario, id_pais_usuario, id_pais_oponente, resultado, fase, puntos_equipo, puntos_oponente) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [userId, id_pais_usuario, id_pais_oponente, resultado, fase, puntos_equipo, puntos_oponente]
        );

        console.log('✅ Partido guardado con ID:', result.insertId);
        res.json({ 
            success: true,
            id_partido: result.insertId,
            mensaje: 'Partido guardado correctamente'
        });

    } catch (error) {
        console.error('❌ Error guardando partido:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            details: error.message 
        });
    }
});

// ====================================
// OBTENER HISTORIAL DE PARTIDOS
// ====================================
router.get('/historial', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log('📜 Obteniendo historial de partidos:', userId);

        const [partidos] = await promisePool.query(
            `SELECT 
                p.id_partido,
                p.resultado,
                p.fase,
                p.puntos_equipo,
                p.puntos_oponente,
                p.fecha_partido,
                pu.nombre as pais_usuario,
                po.nombre as pais_oponente
             FROM partidos p
             INNER JOIN pais pu ON p.id_pais_usuario = pu.id
             INNER JOIN pais po ON p.id_pais_oponente = po.id
             WHERE p.id_usuario = ?
             ORDER BY p.fecha_partido DESC`,
            [userId]
        );

        console.log(`✅ Partidos encontrados: ${partidos.length}`);
        res.json(partidos);

    } catch (error) {
        console.error('❌ Error obteniendo historial:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            details: error.message 
        });
    }
});

module.exports = router;