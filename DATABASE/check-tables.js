const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'poidb'
});

connection.connect((err) => {
    if (err) {
        console.error('Error conectando a la BD:', err);
        return;
    }
    
    console.log('🔍 Verificando tablas de países...');
    
    // Verificar qué tablas existen
    connection.query("SHOW TABLES LIKE '%pais%'", (err, results) => {
        if (err) throw err;
        
        console.log('Tablas encontradas:', results);
        
        if (results.length === 0) {
            console.log('❌ No existe ninguna tabla de países');
        } else {
            results.forEach(table => {
                const tableName = Object.values(table)[0];
                console.log(`\n📊 Estructura de ${tableName}:`);
                
                connection.query(`DESCRIBE ${tableName}`, (err, structure) => {
                    if (err) throw err;
                    console.log(structure);
                });
            });
        }
        
        connection.end();
    });
});