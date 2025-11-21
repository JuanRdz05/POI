const express = require('express');
const router = express.Router();
const { promisePool } = require('../CONFIG/database');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');

const authenticateToken = require('../MIDDLEWARE/auth');


// const tokenAuth = (req, res, next) => {
//     const authHeader = req.headers['authorization'];
//     const token = authHeader && authHeader.split(' ')[1];

//     if (!token) {
//         return res.status(401).json({ error: 'Token requerido' });
//     }

//     jwt.verify(token, process.env.JWT_SECRET || 'tu_clave_secreta', (err, user) => {
//         if (err) {
//             return res.status(403).json({ error: 'Token inválido' });
//         }
//         req.user = user;
//         next();
//     });
// };

//CREA LA CARPETA uploads DONDE SE GUARDAS LOS RECURSOS SUBIDOS POR EL USUARIO
const uploadFolder = path.resolve(__dirname, '../../uploads');
if(!fs.existsSync(uploadFolder))
    fs.mkdirSync(uploadFolder);


// CONFIGURACIÓN PARA SUBIR FOTOS
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadFolder);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, 'foto-perfil-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// CONFIGURACION PARA INSERTAR UN USUARIO
router.post('/register', upload.single('foto'), async (req, res) => {
    try {
        const {
            nombre,
            apellidoPaterno,
            apellidoMaterno,
            nombreUsuario,
            correo,
            contrasena,
            genero,
            fechaNacimiento,
            id_pais
        } = req.body;

        console.log('Datos recibidos:', req.body);

        // VALIDACIONES 
        if (!nombre || !correo || !contrasena || !nombreUsuario) {
            return res.status(400).json({
                success: false,
                error: "Nombre, correo, contraseña y usuario son obligatorios"
            });
        }

        // VALIDACION DE QUE EL CORREO NO EXISTAO
        const [resultCorreo] = await promisePool.query(
            'SELECT COUNT(*) as count FROM usuarios WHERE correo = ?',
            [correo]
        );

        if (resultCorreo[0].count > 0) {
            return res.status(400).json({
                success: false,
                error: "El correo ya existe"
            });
        }

        // VALIDACION DE QUE EL USUARIO NO EXISTA 
        const [resultUsuario] = await promisePool.query(
            'SELECT COUNT(*) as count FROM usuarios WHERE nombreUsuario = ?',
            [nombreUsuario]
        );

        if (resultUsuario[0].count > 0) {
            return res.status(400).json({
                success: false, 
                error: 'El nombre de usuario ya existe'
            });
        }

        // ENCRIPTACIÓN DE LA CONTRASEÑA 
        const saltRounds = 10;
        const contrasenaHasheada = await bcrypt.hash(contrasena, saltRounds);

        // RUTA DE LA FOTO
        const foto = req.file ? req.file.filename : null;

        // INSERTAR USUARIO 
        const [result] = await promisePool.query(
            'INSERT INTO usuarios (nombre, apellidoPaterno, apellidoMaterno, nombreUsuario, correo, contrasena, genero, fechaNacimiento, id_pais, foto) VALUES (?,?,?,?,?,?,?,?,?,?)',
            [
                nombre,
                apellidoPaterno || null,
                apellidoMaterno || null,
                nombreUsuario,
                correo,
                contrasenaHasheada,
                genero || null,
                fechaNacimiento || null,
                id_pais || null,
                foto
            ]
        );

        console.log('Usuario registrado correctamente con ID:', result.insertId);

        res.status(201).json({
            success: true,
            message: 'Usuario registrado correctamente',
            id_usuario: result.insertId
        });

    } catch (error) {
        console.log('Error:', error);
        res.status(500).json({
            success: false,
            error: "Error interno del servidor: " + error.message
        });
    }
});


// METODO PARA OBTENER LOS USUARIOS DEL SERVIDOR
router.get('/', async (req, res) => {
    try {
        const [usuarios] = await promisePool.query('SELECT * FROM usuarios');
        res.json(usuarios);
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: error.message });
    }
});

// METODOS PARA OBTENER USUARIOS POR ID
router.get('/:id', async (req, res) => {
    try {
        const [usuariosId] = await promisePool.query(
            'SELECT id_usuario, nombre, correo, nombreUsuario, contrasena FROM usuarios WHERE id_usuario = ?',
            [req.params.id]
        );

        if (usuariosId.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json(usuariosId[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

//RUTA PARA EL LOGIN
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // VALIDAR CAMPOS 
        if (!email || !password) {
            return res.status(400).json({ error: 'Email y contraseña son requeridos' });
        }

        // BUSCAR EL USUARIO EN LA BASE DE DATOS
        const [users] = await promisePool.query('SELECT * FROM usuarios WHERE correo = ?', [email]);

    
        if (users.length === 0) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

    const user = users[0];
    // VERIFICAR CONTRASEÑA 
    const contraValida = await bcrypt.compare(password, user.contrasena);
    if (!contraValida) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    // CREAR TOKEN DE SESIÓN
    const token = jwt.sign(
        { 
            id: user.id_usuario, 
            email: user.correo, 
            nombre: user.nombre,
            nombreUsuario: user.nombreUsuario, 
            foto: user.foto 
        },
        process.env.JWT_SECRET || 'tu_clave_secreta',
        { expiresIn: '7d' }
    );
    // OBTENER DATOS DEL PAÍS (si existe la relación)
    let paisNombre = null;
    if (user.id_pais) {
        try {
            const [paisData] = await promisePool.query(
                'SELECT nombre FROM pais WHERE id = ?',
                [user.id_pais]
            );
            if (paisData.length > 0) {
                paisNombre = paisData[0].nombre;
            }
        } catch (paisError) {
            console.log('Error obteniendo país:', paisError);
        }
    }
    // ACTUALIZAR EL ESTADO DEL USUARIO 
    await promisePool.query(
        'UPDATE usuarios SET estado_conexion = ? WHERE id_usuario = ?',
        ['online', user.id_usuario]
    );
    res.json({
        message: 'Login exitoso',
        token,
        user: {
            id: user.id_usuario,
            nombre: user.nombre,
            apellidoPaterno: user.apellidoPaterno,
            apellidoMaterno: user.apellidoMaterno,
            apellido: `${user.apellidoPaterno || ''} ${user.apellidoMaterno || ''}`.trim(), // Campo combinado
            email: user.correo,
            foto: user.foto,
            nombreUsuario: user.nombreUsuario,
            genero: user.genero,
            fechaNacimiento: user.fechaNacimiento,
            pais: paisNombre, // Nombre del país en lugar del ID
            id_pais: user.id_pais
        }
    });
    } catch (error) {
        console.log('Error en el login: ', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ENDPOINT PARA OBTENER PERFIL COMPLETO
// router.get('/profile', authenticateToken, async (req, res) => {
//     try {

//         console.log("Profile endpoint fucionando");
//         // Verificar token
//         // const token = req.headers.authorization?.replace('Bearer ', '');
//         // if (!token) {
//         //     return res.status(401).json({ error: 'Token requerido' });
//         // }

//         const userId = req.user.id;

//         // const decoded = jwt.verify(token, process.env.JWT_SECRET || 'tu_clave_secreta');
        
//         // // OBTENER USUARIO COMPLETO CON TODAS LAS COLUMNAS
//         // const [users] = await promisePool.query(
//         //     `SELECT 
//         //         id_usuario, nombre, apellidoPaterno, apellidoMaterno, 
//         //         nombreUsuario, correo, genero, fechaNacimiento, 
//         //         foto, id_pais, estado_conexion, ubicacion, recompensa_total, fecha_registro
//         //     FROM usuarios WHERE id_usuario = ?`,
//         //     [decoded.id]
//         // );
//         const [users] = await promisePool.query(
//             `SELECT 
//                 id_usuario, nombre, apellidoPaterno, apellidoMaterno, 
//                 nombreUsuario, correo, genero, fechaNacimiento, 
//                 foto, id_pais, estado_conexion, ubicacion, recompensa_total, fecha_registro
//             FROM usuarios WHERE id_usuario = ?`,
//             [userId]  // ← Usar userId del middleware
//         );

//         if (users.length === 0) {
//             return res.status(404).json({ error: 'Usuario no encontrado' });
//         }

//         const user = users[0];

//         // OBTENER NOMBRE DEL PAÍS SI EXISTE id_pais
//         let paisNombre = null;
//         if (user.id_pais) {
//             try {
//                 const [paisData] = await promisePool.query(
//                     'SELECT nombre FROM paises WHERE id_pais = ?',
//                     [user.id_pais]
//                 );
//                 if (paisData.length > 0) {
//                     paisNombre = paisData[0].nombre;
//                 }
//             } catch (paisError) {
//                 console.log('Error obteniendo país:', paisError);
//             }
//         }

//         // ENVIAR DATOS COMPLETOS
//         res.json({
//             id: user.id_usuario,
//             nombre: user.nombre,
//             apellidoPaterno: user.apellidoPaterno,
//             apellidoMaterno: user.apellidoMaterno,
//             email: user.correo, // Nota: en frontend usas "email" pero en BD es "correo"
//             foto: user.foto,
//             nombreUsuario: user.nombreUsuario,
//             genero: user.genero,
//             fechaNacimiento: user.fechaNacimiento,
//             pais: paisNombre,
//             id_pais: user.id_pais,
//             // Campos adicionales si los necesitas
//             estado_conexion: user.estado_conexion,
//             ubicacion: user.ubicacion,
//             recompensa_total: user.recompensa_total,
//             fecha_registro: user.fecha_registro
//         });

//     } catch (error) {
//         console.log('Error obteniendo perfil:', error);
//         if (error.name === 'JsonWebTokenError') {
//             return res.status(401).json({ error: 'Token inválido' });
//         }
//         res.status(500).json({ error: 'Error interno del servidor' });
//     }
// });



module.exports = router;