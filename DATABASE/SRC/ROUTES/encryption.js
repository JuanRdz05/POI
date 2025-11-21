// encryption.js - Sistema de Encriptación E2E para Chats
class EncryptionManager {
    constructor() {
        this.algorithm = 'AES-GCM';
        this.keyLength = 256;
        this.ivLength = 12;
        this.saltLength = 16;
        this.iterations = 100000;
    }

    /**
     * Generar una clave de encriptación aleatoria para un chat
     */
    async generateChatKey() {
        const key = await crypto.subtle.generateKey(
            {
                name: this.algorithm,
                length: this.keyLength
            },
            true,
            ['encrypt', 'decrypt']
        );
        
        // Exportar la clave a formato raw
        const rawKey = await crypto.subtle.exportKey('raw', key);
        
        // Convertir a base64 para almacenamiento
        return this.arrayBufferToBase64(rawKey);
    }

    /**
     * Importar una clave desde base64
     */
    async importKey(base64Key) {
        const rawKey = this.base64ToArrayBuffer(base64Key);
        
        return await crypto.subtle.importKey(
            'raw',
            rawKey,
            {
                name: this.algorithm,
                length: this.keyLength
            },
            true,
            ['encrypt', 'decrypt']
        );
    }

    /**
     * Encriptar contenido
     */
    async encrypt(plaintext, base64Key) {
        try {
            // Importar clave
            const key = await this.importKey(base64Key);
            
            // Generar IV aleatorio
            const iv = crypto.getRandomValues(new Uint8Array(this.ivLength));
            
            // Convertir texto a ArrayBuffer
            const encoder = new TextEncoder();
            const data = encoder.encode(plaintext);
            
            // Encriptar
            const ciphertext = await crypto.subtle.encrypt(
                {
                    name: this.algorithm,
                    iv: iv
                },
                key,
                data
            );
            
            // Combinar IV + ciphertext
            const combined = new Uint8Array(iv.length + ciphertext.byteLength);
            combined.set(iv, 0);
            combined.set(new Uint8Array(ciphertext), iv.length);
            
            // Retornar como base64
            return this.arrayBufferToBase64(combined.buffer);
            
        } catch (error) {
            console.error('❌ Error encriptando:', error);
            throw new Error('Error al encriptar el mensaje');
        }
    }

    /**
     * Desencriptar contenido
     */
    async decrypt(base64Ciphertext, base64Key) {
        try {
            // Importar clave
            const key = await this.importKey(base64Key);
            
            // Convertir de base64 a ArrayBuffer
            const combined = this.base64ToArrayBuffer(base64Ciphertext);
            
            // Separar IV y ciphertext
            const iv = combined.slice(0, this.ivLength);
            const ciphertext = combined.slice(this.ivLength);
            
            // Desencriptar
            const decrypted = await crypto.subtle.decrypt(
                {
                    name: this.algorithm,
                    iv: iv
                },
                key,
                ciphertext
            );
            
            // Convertir a texto
            const decoder = new TextDecoder();
            return decoder.decode(decrypted);
            
        } catch (error) {
            console.error('❌ Error desencriptando:', error);
            return '[Mensaje encriptado - Error al desencriptar]';
        }
    }

    /**
     * Utilidades de conversión
     */
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }

    /**
     * Guardar clave de chat en localStorage
     */
    saveChatKey(chatId, key) {
        const keys = this.getAllChatKeys();
        keys[chatId] = key;
        localStorage.setItem('chat_encryption_keys', JSON.stringify(keys));
    }

    /**
     * Obtener clave de chat desde localStorage
     */
    getChatKey(chatId) {
        const keys = this.getAllChatKeys();
        return keys[chatId] || null;
    }

    /**
     * Obtener todas las claves
     */
    getAllChatKeys() {
        const keysJson = localStorage.getItem('chat_encryption_keys');
        return keysJson ? JSON.parse(keysJson) : {};
    }

    /**
     * Eliminar clave de chat
     */
    removeChatKey(chatId) {
        const keys = this.getAllChatKeys();
        delete keys[chatId];
        localStorage.setItem('chat_encryption_keys', JSON.stringify(keys));
    }

    /**
     * Verificar si un chat tiene encriptación activada
     */
    isChatEncrypted(chatId) {
        return this.getChatKey(chatId) !== null;
    }

    /**
     * Guardar preferencia de encriptación en BD
     */
    saveEncryptionPreference(chatId, enabled) {
        const prefs = this.getEncryptionPreferences();
        prefs[chatId] = enabled;
        localStorage.setItem('chat_encryption_prefs', JSON.stringify(prefs));
    }

    /**
     * Obtener preferencia de encriptación
     */
    getEncryptionPreferences() {
        const prefsJson = localStorage.getItem('chat_encryption_prefs');
        return prefsJson ? JSON.parse(prefsJson) : {};
    }
}

// Exportar instancia global
const encryptionManager = new EncryptionManager();

// Hacer disponible globalmente
if (typeof window !== 'undefined') {
    window.encryptionManager = encryptionManager;
}