// DATABASE/SRC/config/database.js
const mysql = require('mysql2');
require('dotenv').config();

// Crear la conexión
const connection = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "root",
    database: "poidb",
    port: 3306
});

// Conectar a la base de datos
connection.connect((error) => {
    if (error) {
        console.error('❌ Error conectando a la base de datos:', error);
        return;
    }
    console.log('✅ Conectado a MySQL correctamente');
});

// Crear pool de conexiones
const pool = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "root",
    database: "poidb",
    port: 3306
});

const promisePool = pool.promise();

// Exportar correctamente
module.exports = {
    connection,  
    promisePool
};