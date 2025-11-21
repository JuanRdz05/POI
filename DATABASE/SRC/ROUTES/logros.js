const express = require('express');
const router = express.Router();
const { promisePool } = require('../CONFIG/database');
const authenticateToken = require('../MIDDLEWARE/auth');

// ========== OBTENER TODOS LOS LOGROS DEL USUARIO ==========
router.get('/mis-logros', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id_usuario;
        console.log('📊 Obteniendo logros para usuario:', userId);

        const query = `
            SELECT 
                l.id_logro,
                l.nombre,
                l.descripcion,
                l.tipo,
                l.condicion_valor,
                l.icono,
                l.marco,
                l.puntos_recompensa,
                l.orden,
                COALESCE(ul.completado, FALSE) as completado,
                COALESCE(ul.progreso_actual, 0) as progreso_actual,
                ul.fecha_desbloqueo
            FROM logros l
            LEFT JOIN usuario_logros ul ON l.id_logro = ul.id_logro AND ul.id_usuario = ?
            WHERE l.activo = TRUE
            ORDER BY l.orden ASC
        `;

        const [logros] = await promisePool.query(query, [userId]);
        
        console.log('✅ Logros obtenidos:', logros.length);
        res.json(logros);

    } catch (error) {
        console.error('❌ Error obteniendo logros:', error);
        res.status(500).json({ 
            error: 'Error al obtener logros',
            message: error.message 
        });
    }
});

// ========== VERIFICAR Y ACTUALIZAR PROGRESO DE LOGROS ==========
router.post('/verificar-progreso', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id_usuario;
        console.log('🔍 Verificando progreso de logros para usuario:', userId);

        // Obtener estadísticas del usuario
        const [stats] = await promisePool.query(`
            SELECT 
                SUM(torneos_jugados) as total_torneos_jugados,
                SUM(torneos_ganados) as total_torneos_ganados,
                SUM(goles_favor) as total_goles
            FROM estadisticas_simulacion
            WHERE id_usuario = ?
        `, [userId]);

        const estadisticas = stats[0] || {
            total_torneos_jugados: 0,
            total_torneos_ganados: 0,
            total_goles: 0
        };

        console.log('📈 Estadísticas del usuario:', estadisticas);

        // Obtener todos los logros activos
        const [logros] = await promisePool.query(`
            SELECT * FROM logros WHERE activo = TRUE
        `);

        const logrosActualizados = [];

        for (const logro of logros) {
            let progresoActual = 0;
            let completado = false;

            // Calcular progreso según el tipo de logro
            switch (logro.tipo) {
                case 'mundial':
                    progresoActual = estadisticas.total_torneos_jugados || 0;
                    break;
                case 'goles':
                    progresoActual = estadisticas.total_goles || 0;
                    break;
                case 'torneos':
                    progresoActual = estadisticas.total_torneos_jugados || 0;
                    break;
                case 'victorias':
                    progresoActual = estadisticas.total_torneos_ganados || 0;
                    break;
            }

            // Verificar si el logro está completado
            completado = progresoActual >= logro.condicion_valor;

            // Verificar si ya existía este logro para el usuario
            const [existente] = await promisePool.query(`
                SELECT completado FROM usuario_logros 
                WHERE id_usuario = ? AND id_logro = ?
            `, [userId, logro.id_logro]);

            const yaCompletado = existente.length > 0 && existente[0].completado;

            // Actualizar o insertar el progreso del logro
            await promisePool.query(`
                INSERT INTO usuario_logros (id_usuario, id_logro, progreso_actual, completado, fecha_desbloqueo)
                VALUES (?, ?, ?, ?, IF(? = TRUE, NOW(), NULL))
                ON DUPLICATE KEY UPDATE 
                    progreso_actual = VALUES(progreso_actual),
                    completado = VALUES(completado),
                    fecha_desbloqueo = IF(completado = FALSE AND VALUES(completado) = TRUE, NOW(), fecha_desbloqueo)
            `, [userId, logro.id_logro, progresoActual, completado, completado]);

            // Si se acaba de completar (no estaba completado antes), agregarlo a la lista
            if (completado && !yaCompletado) {
                logrosActualizados.push({
                    id_logro: logro.id_logro,
                    nombre: logro.nombre,
                    recien_desbloqueado: true
                });
            }
        }

        console.log('✅ Progreso de logros actualizado');
        res.json({
            message: 'Progreso actualizado correctamente',
            logrosDesbloqueados: logrosActualizados,
            estadisticas
        });

    } catch (error) {
        console.error('❌ Error verificando progreso:', error);
        res.status(500).json({ 
            error: 'Error al verificar progreso',
            message: error.message 
        });
    }
});

// ========== EQUIPAR/DESEQUIPAR MARCO ==========
router.post('/equipar-marco', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id_usuario;
        const { id_logro } = req.body;

        console.log('🎨 Usuario', userId, 'equipando marco del logro:', id_logro);

        // Verificar que el usuario ha desbloqueado este logro
        const [logro] = await promisePool.query(`
            SELECT ul.completado, l.nombre, l.marco
            FROM usuario_logros ul
            JOIN logros l ON ul.id_logro = l.id_logro
            WHERE ul.id_usuario = ? AND ul.id_logro = ?
        `, [userId, id_logro]);

        if (logro.length === 0 || !logro[0].completado) {
            return res.status(403).json({ 
                error: 'No has desbloqueado este logro' 
            });
        }

        // Desactivar todos los marcos del usuario
        await promisePool.query(`
            UPDATE usuarios_marcos 
            SET activo = FALSE 
            WHERE id_usuario = ?
        `, [userId]);

        // Verificar si ya existe un registro para este marco
        const [marcoExistente] = await promisePool.query(`
            SELECT id_usuario_marco FROM usuarios_marcos
            WHERE id_usuario = ? AND id_logro = ?
        `, [userId, id_logro]);

        if (marcoExistente.length > 0) {
            // Actualizar el registro existente
            await promisePool.query(`
                UPDATE usuarios_marcos 
                SET activo = TRUE, fecha_equipado = NOW()
                WHERE id_usuario = ? AND id_logro = ?
            `, [userId, id_logro]);
        } else {
            // Insertar nuevo registro
            await promisePool.query(`
                INSERT INTO usuarios_marcos (id_usuario, id_logro, activo, fecha_equipado)
                VALUES (?, ?, TRUE, NOW())
            `, [userId, id_logro]);
        }

        console.log('✅ Marco equipado:', logro[0].nombre);
        res.json({
            message: 'Marco equipado correctamente',
            marco: logro[0].marco,
            nombre: logro[0].nombre
        });

    } catch (error) {
        console.error('❌ Error equipando marco:', error);
        res.status(500).json({ 
            error: 'Error al equipar marco',
            message: error.message 
        });
    }
});

// ========== OBTENER MARCO ACTIVO DEL USUARIO ==========
router.get('/marco-activo', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id_usuario;

        const [marco] = await promisePool.query(`
            SELECT l.marco, l.nombre
            FROM usuarios_marcos um
            JOIN logros l ON um.id_logro = l.id_logro
            WHERE um.id_usuario = ? AND um.activo = TRUE
            LIMIT 1
        `, [userId]);

        if (marco.length === 0) {
            return res.json({ marco: null });
        }

        res.json(marco[0]);

    } catch (error) {
        console.error('❌ Error obteniendo marco activo:', error);
        res.status(500).json({ 
            error: 'Error al obtener marco activo',
            message: error.message 
        });
    }
});

// ========== DESEQUIPAR MARCO ==========
router.post('/desequipar-marco', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id_usuario;

        await promisePool.query(`
            UPDATE usuarios_marcos 
            SET activo = FALSE 
            WHERE id_usuario = ?
        `, [userId]);

        console.log('✅ Marco desequipado');
        res.json({ message: 'Marco desequipado correctamente' });

    } catch (error) {
        console.error('❌ Error desequipando marco:', error);
        res.status(500).json({ 
            error: 'Error al desequipar marco',
            message: error.message 
        });
    }
});

// ========== OBTENER ESTADÍSTICAS DE LOGROS ==========
router.get('/estadisticas', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id_usuario;

        const [stats] = await promisePool.query(`
            SELECT 
                COUNT(*) as total_logros,
                SUM(CASE WHEN ul.completado = TRUE THEN 1 ELSE 0 END) as logros_completados,
                SUM(CASE WHEN ul.completado = TRUE THEN l.puntos_recompensa ELSE 0 END) as puntos_totales
            FROM logros l
            LEFT JOIN usuario_logros ul ON l.id_logro = ul.id_logro AND ul.id_usuario = ?
            WHERE l.activo = TRUE
        `, [userId]);

        res.json(stats[0] || {
            total_logros: 0,
            logros_completados: 0,
            puntos_totales: 0
        });

    } catch (error) {
        console.error('❌ Error obteniendo estadísticas:', error);
        res.status(500).json({ 
            error: 'Error al obtener estadísticas',
            message: error.message 
        });
    }
});

module.exports = router;