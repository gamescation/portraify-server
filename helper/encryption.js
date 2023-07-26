const CryptoJS = require('crypto-js');
const jwt = require('jsonwebtoken');

const secretKey = process.env.SECRET_KEY; // This should be a strong and unique key
const jwtSecret = process.env.JWT_SECRET_KEY; // This should also be a strong and unique key
const appSecret = process.env.APP_SECRET;

// Encrypt a message
function encryptMessage(message) {
    const encrypted = CryptoJS.AES.encrypt(message, secretKey);
    return encrypted.toString();
}

// Decrypt a message
function decryptMessage(encryptedMessage) {
    const decrypted = CryptoJS.AES.decrypt(encryptedMessage, secretKey);
    return decrypted.toString(CryptoJS.enc.Utf8);
}

// Convert a string to Base64
function stringToBase64(str) {
    return CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(str));
}

// Convert a Base64 string back to a normal string
function base64ToString(base64) {
    return CryptoJS.enc.Base64.parse(base64).toString(CryptoJS.enc.Utf8);
}

// Create a JSON Web Token
function createJWT(payload) {
    return jwt.sign(payload, jwtSecret);
}

// Verify a JSON Web Token
function verifyJWT(token) {
    try {
        return jwt.verify(token, jwtSecret);
    } catch (error) {
        console.error('JWT verification failed:', error.message);
        return null;
    }
}


// Combined function to encrypt, JWT encode, and Base64 convert
function encryptJwtBase64({ data }) {
    const jsonString = JSON.stringify(data);
    const encryptedMessage = encryptMessage(jsonString);
    const jwtToken = createJWT({ message: encryptedMessage });
    return jwtToken;
}

// Combined function to reverse the process: Base64 decode, JWT decode, and decrypt
function decryptJwtBase64(jwtToken) {
    const decodedPayload = verifyJWT(jwtToken);

    if (decodedPayload === null) {
        return null;
    }

    const decryptedMessage = decryptMessage(decodedPayload.message);
    return JSON.parse(decryptedMessage);
}


// Hash a string using SHA-256
function sha256(str) {
    return CryptoJS.SHA256(str).toString();
}

const generateToken = ({ data }) => {
    return encryptJwtBase64({ data });
}

const validateHash = ({ uniqueId, time, os, hash }) => {
    return sha256(`${uniqueId}-${time}-${appSecret}-${os}`) === hash;
}

module.exports = {
    encryptJwtBase64,
    decryptJwtBase64,
    appSecret,
    sha256,
    generateToken,
    validateHash
}
