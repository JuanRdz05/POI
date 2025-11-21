// ROUTES/estadisticas.js
const express = require('express');
const router = express.Router();
const { promisePool } = require('../CONFIG/database');
const authenticateToken = require('../MIDDLEWARE/auth');

// ====================================
// INICIAR NUEVO TORNEO
// ====================================
router.post('/iniciar-torneo', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Obtener país del usuario
        const [users] = await promisePool.query(
            'SELECT id_pais FROM usuarios WHERE id_usuario = ?',
            [userId]
        );
        
        if (users.length === 0 || !users[0].id_pais) {
            return res.status(400).json({ 
                error: 'No tienes un país seleccionado' 
            });
        }
        
        const idPais = users[0].id_pais;
        
        // Crear registro de torneo
        const [result] = await promisePool.query(
            `INSERT INTO historial_torneos 
             (id_usuario, id_pais, posicion_final, campeon) 
             VALUES (?, ?, 'En progreso', 'TBD')`,
            [userId, idPais]
        );
        
        console.log('✅ Torneo iniciado con ID:', result.insertId);
        
        res.json({ 
            success: true,
            id_torneo: result.insertId,
            mensaje: 'Torneo iniciado correctamente'
        });
        
    } catch (error) {
        console.error('❌ Error iniciando torneo:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            details: error.message 
        });
    }
});

// ====================================
// GUARDAR PARTIDO
// ====================================
router.post('/guardar-partido', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { 
            id_torneo,
            id_pais_oponente, 
            resultado, 
            fase,
            goles_usuario,
            goles_oponente,
            fue_penales,
            fue_dramatico,
            puntos_equipo, 
            puntos_oponente 
        } = req.body;
        
        // Validar datos
        if (!id_torneo || !id_pais_oponente || !resultado || !fase) {
            return res.status(400).json({ 
                error: 'Datos incompletos para guardar el partido' 
            });
        }
        
        // Obtener país del usuario
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
             (id_torneo, id_usuario, id_pais_usuario, id_pais_oponente, 
              resultado, fase, goles_usuario, goles_oponente, 
              fue_penales, fue_dramatico, puntos_equipo, puntos_oponente) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id_torneo, userId, id_pais_usuario, id_pais_oponente, 
             resultado, fase, goles_usuario || 0, goles_oponente || 0,
             fue_penales ? 1 : 0, fue_dramatico ? 1 : 0, 
             puntos_equipo, puntos_oponente]
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
// FINALIZAR TORNEO Y ACTUALIZAR ESTADÍSTICAS
// ====================================
router.post('/finalizar-torneo', authenticateToken, async (req, res) => {
    const connection = await promisePool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const userId = req.user.id;
        const { 
            id_torneo, 
            posicion_final, 
            campeon,
            racha_maxima 
        } = req.body;
        
        // Validar datos
        if (!id_torneo || !posicion_final || !campeon) {
            await connection.rollback();
            return res.status(400).json({ 
                error: 'Datos incompletos para finalizar el torneo' 
            });
        }
        
        // Obtener estadísticas del torneo
        const [partidos] = await connection.query(
            `SELECT 
                COUNT(*) as total_partidos,
                SUM(CASE WHEN resultado = 'ganado' THEN 1 ELSE 0 END) as ganados,
                SUM(CASE WHEN resultado = 'perdido' THEN 1 ELSE 0 END) as perdidos,
                SUM(goles_usuario) as goles_favor,
                SUM(goles_oponente) as goles_contra
             FROM partidos 
             WHERE id_torneo = ? AND id_usuario = ?`,
            [id_torneo, userId]
        );
        
        const stats = partidos[0];
        
        // Actualizar torneo
        await connection.query(
            `UPDATE historial_torneos 
             SET posicion_final = ?, 
                 campeon = ?,
                 partidos_jugados = ?,
                 partidos_ganados = ?,
                 partidos_perdidos = ?,
                 goles_favor = ?,
                 goles_contra = ?,
                 racha_maxima = ?
             WHERE id_torneo = ? AND id_usuario = ?`,
            [posicion_final, campeon, 
             stats.total_partidos, stats.ganados, stats.perdidos,
             stats.goles_favor, stats.goles_contra, racha_maxima || 0,
             id_torneo, userId]
        );
        
        // Obtener país del usuario
        const [userData] = await connection.query(
            'SELECT id_pais FROM usuarios WHERE id_usuario = ?',
            [userId]
        );
        
        const idPais = userData[0].id_pais;
        
        // Actualizar estadísticas generales
        const esGanador = posicion_final === 'Campeón' ? 1 : 0;
        
        await connection.query(
            `INSERT INTO estadisticas_simulacion 
             (id_usuario, id_pais, torneos_jugados, torneos_ganados, torneos_perdidos,
              partidos_jugados, partidos_ganados, partidos_perdidos,
              goles_favor, goles_contra, mejor_posicion)
             VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                torneos_jugados = torneos_jugados + 1,
                torneos_ganados = torneos_ganados + ?,
                torneos_perdidos = torneos_perdidos + ?,
                partidos_jugados = partidos_jugados + ?,
                partidos_ganados = partidos_ganados + ?,
                partidos_perdidos = partidos_perdidos + ?,
                goles_favor = goles_favor + ?,
                goles_contra = goles_contra + ?,
                mejor_posicion = CASE 
                    WHEN mejor_posicion IS NULL THEN ?
                    WHEN ? = 'Campeón' THEN 'Campeón'
                    WHEN mejor_posicion != 'Campeón' AND ? = 'Subcampeón' THEN 'Subcampeón'
                    ELSE mejor_posicion
                END`,
            [userId, idPais, esGanador, esGanador === 0 ? 1 : 0,
             stats.total_partidos, stats.ganados, stats.perdidos,
             stats.goles_favor, stats.goles_contra, posicion_final,
             esGanador, esGanador === 0 ? 1 : 0,
             stats.total_partidos, stats.ganados, stats.perdidos,
             stats.goles_favor, stats.goles_contra, posicion_final,
             posicion_final, posicion_final]
        );
        
        // Actualizar penales si los hubo
        const [penales] = await connection.query(
            `SELECT 
                SUM(CASE WHEN fue_penales = 1 AND resultado = 'ganado' THEN 1 ELSE 0 END) as ganados,
                SUM(CASE WHEN fue_penales = 1 AND resultado = 'perdido' THEN 1 ELSE 0 END) as perdidos
             FROM partidos 
             WHERE id_torneo = ? AND id_usuario = ?`,
            [id_torneo, userId]
        );
        
        if (penales[0].ganados > 0 || penales[0].perdidos > 0) {
            await connection.query(
                `UPDATE estadisticas_simulacion 
                 SET penales_ganados = penales_ganados + ?,
                     penales_perdidos = penales_perdidos + ?
                 WHERE id_usuario = ? AND id_pais = ?`,
                [penales[0].ganados, penales[0].perdidos, userId, idPais]
            );
        }
        
        await connection.commit();
        
        console.log('✅ Torneo finalizado y estadísticas actualizadas');
        
        res.json({ 
            success: true,
            mensaje: 'Torneo finalizado correctamente',
            estadisticas: stats
        });
        
    } catch (error) {
        await connection.rollback();
        console.error('❌ Error finalizando torneo:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            details: error.message 
        });
    } finally {
        connection.release();
    }
});

// ====================================
// OBTENER ESTADÍSTICAS DEL USUARIO
// ====================================
router.get('/mis-estadisticas', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        const [stats] = await promisePool.query(
            `SELECT 
                e.*,
                p.nombre as pais_nombre,
                ROUND((e.partidos_ganados * 100.0) / NULLIF(e.partidos_jugados, 0), 2) as porcentaje_victorias
             FROM estadisticas_simulacion e
             LEFT JOIN pais p ON e.id_pais = p.id
             WHERE e.id_usuario = ?`,
            [userId]
        );
        
        if (stats.length === 0) {
            return res.json({
                mensaje: 'No has jugado ningún torneo todavía',
                estadisticas: null
            });
        }
        
        res.json({
            success: true,
            estadisticas: stats[0]
        });
        
    } catch (error) {
        console.error('❌ Error obteniendo estadísticas:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            details: error.message 
        });
    }
});

// ====================================
// OBTENER HISTORIAL DE TORNEOS
// ====================================
router.get('/historial-torneos', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { limite = 10 } = req.query;
        
        const [torneos] = await promisePool.query(
            `SELECT 
                ht.*,
                p.nombre as pais_nombre
             FROM historial_torneos ht
             LEFT JOIN pais p ON ht.id_pais = p.id
             WHERE ht.id_usuario = ?
             ORDER BY ht.fecha_torneo DESC
             LIMIT ?`,
            [userId, parseInt(limite)]
        );
        
        res.json({
            success: true,
            torneos: torneos
        });
        
    } catch (error) {
        console.error('❌ Error obteniendo historial:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            details: error.message 
        });
    }
});

// ====================================
// OBTENER PARTIDOS DE UN TORNEO
// ====================================
router.get('/partidos-torneo/:id_torneo', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id_torneo } = req.params;
        
        const [partidos] = await promisePool.query(
            `SELECT 
                p.*,
                pu.nombre as pais_usuario_nombre,
                po.nombre as pais_oponente_nombre
             FROM partidos p
             LEFT JOIN pais pu ON p.id_pais_usuario = pu.id
             LEFT JOIN pais po ON p.id_pais_oponente = po.id
             WHERE p.id_torneo = ? AND p.id_usuario = ?
             ORDER BY p.fecha_partido ASC`,
            [id_torneo, userId]
        );
        
        res.json({
            success: true,
            partidos: partidos
        });
        
    } catch (error) {
        console.error('❌ Error obteniendo partidos:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            details: error.message 
        });
    }
});

// ====================================
// OBTENER RANKING GLOBAL
// ====================================
router.get('/ranking', async (req, res) => {
    try {
        const { limite = 10 } = req.query;
        
        const [ranking] = await promisePool.query(
            `SELECT 
                u.nombreUsuario,
                u.nombre,
                p.nombre as pais_nombre,
                e.torneos_ganados,
                e.torneos_jugados,
                e.partidos_ganados,
                e.partidos_jugados,
                ROUND((e.partidos_ganados * 100.0) / NULLIF(e.partidos_jugados, 0), 2) as porcentaje_victorias
             FROM estadisticas_simulacion e
             JOIN usuarios u ON e.id_usuario = u.id_usuario
             LEFT JOIN pais p ON e.id_pais = p.id
             ORDER BY e.torneos_ganados DESC, e.partidos_ganados DESC
             LIMIT ?`,
            [parseInt(limite)]
        );
        
        res.json({
            success: true,
            ranking: ranking
        });
        
    } catch (error) {
        console.error('❌ Error obteniendo ranking:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            details: error.message 
        });
    }
});

module.exports = router;