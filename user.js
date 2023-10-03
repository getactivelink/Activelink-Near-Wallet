const nearApi = require('near-api-js');
const blockchain = require('./blockchain');
const nearSeedPhrase = require('near-seed-phrase');
const fs = require('fs');

const storageFolder = "storage";

module.exports = {
    GenerateKeyPair: async function () {
        const keypair = nearApi.utils.KeyPair.fromRandom('ed25519');

        return {
            public_key: keypair.publicKey.toString(),
            private_key: keypair.secretKey
        };
    },

    CreateKeyPair: async function (name) {
        const keypair = nearApi.utils.KeyPair.fromRandom('ed25519');

        const account =
            {
                account_id: name,
                public_key: keypair.publicKey.toString(),
                private_key: keypair.secretKey
            };

        return account;
    },

    /**
     * @return {string}
     */
    GetFileName: function (account_id) {
        return `${storageFolder}/${account_id}.json`;
    },

    SaveKeyPair: async function (account) {
        if (!fs.existsSync(storageFolder))
            fs.mkdirSync(storageFolder);

        const filename = this.GetFileName(account.account_id);
        account.private_key = "ed25519:" + account.private_key;

        await fs.promises.writeFile(filename, JSON.stringify(account));
    },

    /**
     * @return {boolean}
     */
    CreateAccount: async function (new_account) {
        const account = await blockchain.GetMasterAccount();
        
        try {
            const res = await account.createAccount(new_account.account_id, new_account.public_key, '200000000000000000000000');
            if (res['status'].hasOwnProperty('SuccessValue')) {
                await this.SaveKeyPair(new_account);
                return true;
            }
        } catch (e) {
            if (e.type === 'AccountAlreadyExists') {
                // Account already exists, handle it as needed
               // console.log(`Account ${new_account.account_id} already exists.`);
                return `Account ${new_account.account_id} already exists.`; // You can choose to return false or throw an error here
            } else {
                //console.error(e);
               // console.log("Other error occurred");
                return "Other error occurred"; // Handle other errors as needed
            }
        }
        return false;
    },
    

    GetAccount: async function (account_id) {
        const filename = this.GetFileName(account_id);
        return await fs.promises.readFile(filename, 'utf8');
    },

    GetKeysFromSeedPhrase: async function (seedPhrase) {
        return nearSeedPhrase.parseSeedPhrase(seedPhrase);
    }
};


