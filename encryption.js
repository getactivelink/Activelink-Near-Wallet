var CryptoJS = require("crypto-js");
const key = "wPfE_g3iJ,+5014[r##(&=n-%Po,K664%BhPY3j[Eq$Acg{>gSWn1k1YBkc8";

// Crypto Encrypting text
function CryptoEncrypt(data) {
    try {
        var ciphertext = CryptoJS.AES.encrypt(JSON.stringify(data), key).toString();
        return ciphertext;
    } catch (e) {
        // Handle encryption error here
        return e.message;
    }
}

// Crypto Decrypting text
function CryptoDecrypt(data) {
    try {
        console.log(data)
        var bytes  = CryptoJS.AES.decrypt(data, key);
        console.log(bytes)
        var decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        return decryptedData;
    } catch (e) {
        // Handle decryption error here
        return e.message;
    }
}

// HMAC Encrypting text
function HMACEncrypt(data) {
    try {
        var ciphertext = CryptoJS.HmacSHA512(JSON.stringify(data), key).toString();
        return ciphertext;
    } catch (e) {
        // Handle HMAC encryption error here
        return e.message;
    }
}

module.exports = {
    encrypt: async function (data) {
        try {
            return CryptoEncrypt(data);
        } catch (e) {
            // Handle encryption error here
            return e.message;
        }
    },

    decrypt: async function (encData) {
        try {
            if (!encData) {
                // Handle missing encData
                return { status: 0, errors: { encData: "Please add encrypted string!" } };
            }
            return CryptoDecrypt(encData);
        } catch (e) {
            // Handle decryption error here
            return { status: 0, errors: { decryptError: e.message } };
        }
    },

    hashEncrypt: async function (data) {
        try {
            return HMACEncrypt(data);
        } catch (e) {
            // Handle HMAC encryption error here
            return e.message;
        }
    },
};
