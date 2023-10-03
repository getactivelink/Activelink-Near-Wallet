#!/usr/bin/env node

'use strict';
const user = require('./user');
const token = require('./token');
const blockchain = require('./blockchain');
const encryption = require('./encryption');
const api = require('./api');
const faker = require('faker');
const crypto = require('crypto');
const CatboxMemory = require('@hapi/catbox-memory');
const Hapi = require('@hapi/hapi');
const fs = require('fs');
const {Client} = require('pg');

const mongoose = require("mongoose");
const UserModel = require("./Model/userModel");
var CryptoJS = require("crypto-js");
Client.poolSize = 100;

const settings = JSON.parse(fs.readFileSync(api.CONFIG_PATH, 'utf8'));
const ViewCacheExpirationInSeconds = 10;
const ViewGenerateTimeoutInSeconds = 30;

const key = 'wPfE_g3iJ,+5014[r##(&=n-%Po,K664%BhPY3j[Eq$Acg{>gSWn1k1YBkc8';

// const { MongoClient } = require('mongodb');
const mongoUrl = 'mongodb://web3-mongo:9Kms9GSdAwRR@34.172.131.122:27017/myFirstDatabase?serverSelectionTimeoutMS=5000&connectTimeoutMS=10000&authSource=admin&authMechanism=SCRAM-SHA-1';
// const mongoClient = new MongoClient(mongoUrl, {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// });


const init = async () => {
    try {
        
        mongoose
            .connect(mongoUrl, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        })
        .then(() => {
            console.log("Connected to MongoDB");
            // Place your server initialization code here
        })
        .catch((error) => {
            console.error("Error connecting to MongoDB:", error);
            process.exit(1); // Exit the process if MongoDB connection fails
        });

        const server = Hapi.server({
            port: settings.server_port,
            host: settings.server_host,
            cache: [
                {
                    name: 'near-api-cache',
                    provider: {
                        constructor: CatboxMemory
                    }
                }
            ]
        });
        //console.log("adadadad")

        function processRequest(request) {
            Object.keys(request.payload).map((key) => {
                switch (request.payload[key]) {
                    case '{username}':
                        request.payload[key] = faker.internet
                            .userName()
                            .replace(/[^0-9a-z]/gi, '');
                        break;
                    case '{color}':
                        request.payload[key] = faker.internet.color();
                        break;
                    case '{number}':
                        request.payload[key] = faker.random.number();
                        break;
                    case '{word}':
                        request.payload[key] = faker.random.word();
                        break;
                    case '{words}':
                        request.payload[key] = faker.random.words();
                        break;
                    case '{image}':
                        request.payload[key] = faker.random.image();
                        break;
                }
            });

            return request;
        }


        function CryptoEncrypt(data, xp_password) {
            var ciphertext = CryptoJS.AES.encrypt(JSON.stringify(data), xp_password).toString();
            return ciphertext;
        }
        
        // Crypto Decrypting text
        function CryptoDecrypt(data, xp_password) {
            try {
                var bytes  = CryptoJS.AES.decrypt(data, xp_password);
                var decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
                return decryptedData;
            } catch (e) {
                return e.message;
            }
        }

        // HMAC Encrypting text
        function HMACEncrypt(data, xp_password) {
            var ciphertext = CryptoJS.HmacSHA512(JSON.stringify(data), xp_password).toString();
            return ciphertext;
        }

        server.route({
            method: 'GET',
            path: '/',
            handler: () => {
                return api.notify(
                    'Welcome to NEAR REST API SERVER (https://github.com/near-examples/near-api-rest-server)! ' +
                    (!settings.master_account_id
                        ? 'Please initialize your NEAR account in order to use simple nft mint/transfer methods'
                        : `Master Account: ${settings.master_account_id}`)
                );
            },
        });

        server.route({
            method: 'POST',
            path: '/view',
            handler: async (request, h) => {
                request = processRequest(request);

                if (request.payload.disabled_cache) {
                    return blockchain.View(
                        request.payload.contract,
                        request.payload.method,
                        request.payload.params,
                        request.payload.rpc_node,
                        request.payload.headers
                    );
                } else {
                    request.payload.request_name = "view";
                    return replyCachedValue(h, await server.methods.view(request.payload));
                }
            }
        });

        server.method(
            'view',
            async (params) => blockchain.View(
                params.contract,
                params.method,
                params.params,
                params.rpc_node,
                params.headers
            ),
            getServerMethodParams());

        server.route({
            method: 'POST',
            path: '/call',
            handler: async (request) => {
                request = processRequest(request);
                let {
                    account_id,
                    private_key,
                    attached_tokens,
                    attached_gas,
                    contract,
                    method,
                    params,
                    network,
                    rpc_node,
                    headers
                } = request.payload;
                return await blockchain.Call(
                    account_id,
                    private_key,
                    attached_tokens,
                    attached_gas,
                    contract,
                    method,
                    params,
                    network,
                    rpc_node,
                    headers
                );
            },
        });

        server.route({
            method: 'POST',
            // path: '/init/{master_account_id}/{nft_contract}/{server_host}/{server_port}',
            path: '/init',
            handler: async (request) => {
                if (settings.init_disabled) {
                    return api.reject('Method now allowed');
                }

            request = processRequest(request);
                let {
                    master_account_id,
                    seed_phrase,
                    private_key,
                    nft_contract,
                    server_host,
                    server_port,
                    rpc_node,
                } = request.payload;
                // let seed_phrase = "about armed mercy ensure bless essay floor peasant round example say festival";
                // let rpc_node = "https://rpc.testnet.near.org";
                // let private_key="";
                //console.log(seed_phrase)
                //return seed_phrase;
                if (seed_phrase)
                    private_key = (await user.GetKeysFromSeedPhrase(seed_phrase)).secretKey;

                    
                    //console.log(private_key)
                    //return private_key
                let response = await blockchain.Init(
                    master_account_id,
                    private_key,
                    nft_contract,
                    server_host,
                    server_port, 
                    rpc_node
                );
                if (!response.error) {
                    process.on('SIGINT', function () {
                        console.log('Stopping server...');
                        server.stop({timeout: 1000}).then(async function () {
                            await server.start();
                        });
                    });
                }

                return response;
            },
        });

        server.route({
            method: 'POST',
            path: '/deploy',
            handler: async (request) => {
                request = processRequest(request);
                let {account_id, private_key, seed_phrase, contract} = request.payload;

                if (seed_phrase)
                    private_key = (await user.GetKeysFromSeedPhrase(seed_phrase)).secretKey;

                return await blockchain.DeployContract(account_id, private_key, contract);
            },
        });

        server.route({
            method: 'GET',
            path: '/view_nft/{token_id}',
            handler: async (request, h) => {
                request.params.request_name = "view_nft";
                return replyCachedValue(h, await server.methods.viewNFT(request.params));
            },
        });

        server.method(
            'viewNFT',
            async (params) => await token.ViewNFT(params.token_id),
            getServerMethodParams());

        server.route({
            method: 'POST',
            path: '/view_nft',
            handler: async (request) => {
                return await token.ViewNFT(
                    request.payload.token_id,
                    request.payload.contract
                );
            },
        });

        server.route({
            
            method: 'POST',
            // path: '/create_user/{name}',
            path: '/create_user',
            handler: async (request,h) => {
                request = processRequest(request);
                const name = (
                    request.payload.name +
                    '.' +
                    settings.master_account_id
                ).toLowerCase();
                    const { xp_password } = CryptoDecrypt(request.payload.walletAesFormat, key);
                    if (!xp_password) {
                        // return res.json({ status: 0, errors: { xp_password: "Password is required!" }});
                        return api.reject("Password is required");
                    }
                    if(!request.headers.hmac){
                        // return res.json({ status: 0, errors: { hmac: "HMAC is required!" }});
                        return api.reject("HMAC is required!");
                    }
                    var data={
                        xp_password,
                    };
                    let hmacData=HMACEncrypt(data, key);
                    if(hmacData!=request.headers.hmac){
                        // return res.json({ status: 0, errors:{ hmac: "HMAC is invalid!" } });
                        return api.reject("HMAC is invalid!");
                    }
                    let account = await user.CreateKeyPair(name);
                    let status = await user.CreateAccount(account);
                    const newUser = new UserModel({
                        account_id: account.account_id,
                        walletAddress: account.public_key,
                        privateKey: CryptoEncrypt(account.private_key, xp_password),
                        isDisabled: 0,
                    });
                if (status === true){
                    //  return {
                    //     text: `Account ${name} created. Public key: ${account.public_key}`,
                    // };

                    //Saving user in database.
                    await newUser.save();

                    // // logController.logs({walletAddress: userWallet.address, type: "createWallet", buyByMatic: "false", token: "", estimateTransactionFee: "", receiverAddress: "", txHash: "", log: "User has created wallet address!"});

                    // console.log(newUser);
                    // return;
                    // res.json({
                    //     status: 1,
                    //     action: 'register',
                    //     user: CryptoEncrypt({
                    //         ...newUser._doc,
                    //     }, key),
                    // });

                    const responseData = {
                        status: 1,
                        action: 'register',
                        // Include your data here
                        user: CryptoEncrypt({
                            ...newUser._doc,
                        }, key),
                    };
                    const response = h.response(responseData);
                    response.type('application/json');
                    return response;
                }else{
                    //return {text: 'Error'};
                    const responseData = {
                        status: 0,
                        action: 'register',
                        // Include your data here
                        errors: status,
                    };
                    const response = h.response(responseData);
                    response.type('application/json');
                    return response;
                } 
            },
        });


        server.route({
        
            method: 'POST',
            // path: '/create_user/{name}',
            path: '/send_near_old',
            handler: async (request) => {
                //console.log(request) 
                request = processRequest(request);
    
                let {account_id, private_key, seed_phrase, receiver, amount} = request.payload;
    
                if (seed_phrase)
                    private_key = (await user.GetKeysFromSeedPhrase(seed_phrase)).secretKey;
    
                return await blockchain.SendNear(account_id, private_key, receiver, amount);
            },
        });

        server.route({
            
            method: 'POST',
            path: '/send_near',
            handler: async (request) => {
                //console.log(request) 
                request = processRequest(request);

                let {account_id, private_key, seed_phrase, receiver, amount} = request.payload;

                if (seed_phrase)
                    private_key = (await user.GetKeysFromSeedPhrase(seed_phrase)).secretKey;

                // return await blockchain.SendNear(account_id, private_key, receiver, amount);
                return await blockchain.SendXp(request.payload.data, request.headers.hmac);
            },
        });

        server.route({
            method: 'POST',
            path: '/parse_seed_phrase',
            handler: async (request) => {
                request = processRequest(request);

                return await user.GetKeysFromSeedPhrase(request.payload.seed_phrase);
            },
        });

        server.route({
            method: 'GET',
            path: '/balance/{account_id}',
            handler: async (request) => {
                //console.log(request) 

                let balance = await blockchain.GetBalance(request.params.account_id);
                return {
                    balance: `Account balance is: ${balance}`,
                };
            }
        });


        server.route({
            method: 'GET',
            path: '/testmogo',
            handler: async () => {
                //console.log(request) 

            //    var aa =  await UserModel.find;
            //         console.log(aa)
            //     return "sf";
                const newUser = new UserModel({
                    account_id: "vkptestmongo",
                    walletAddress: "vkptestmongo",
                    privateKey: "vkptestmongo",
                    isDisabled: 0,
                });
            
                console.log(newUser)
                try {
                    let a = await newUser.save();
                    console.log("Data saved successfully:", a);
                    return "Data saved successfully";
                  } catch (error) {
                    console.error("Error saving data:", error);
                    return "Error saving data";
                  }
            //    console.log(a)
               console.log("sfsfsff")
               return "rrrr";
            }
        });

        server.route({
            method: 'POST',
            path: '/walletInformation',
            handler: async (request,h) => {
                // console.log(request)  
                // return "sdsdsd";

                request = processRequest(request);

                // let balance = await blockchain.GetBalance(request.payload.account_id);
                let balance = await blockchain.walletInformation(request.payload.data, request.headers.hmac);
                
                // console.log(balance);
                // return "sczczxc";
                return balance;
                // return {
                //     balance: `Account balance is: ${balance}`,
                // };
            }
        });

        server.route({
            method: 'GET',
            path: '/keypair',
            handler: async () => {
                return await user.GenerateKeyPair();
            }
        });

        server.route({
            method: 'POST',
            path: '/mint_nft',
            handler: async (request) => {
                let {min, max} = request.payload;

                if (!min || !max) min = max = 0;
                let response = [];

                request = processRequest(request);
                for (let i = min; i <= max; i++) {
                    const tokenId = request.payload.token_id.replace('{inc}', i);

                    let {account_id, private_key, metadata, contract} = request.payload;

                    const tx = await token.MintNFT(
                        tokenId,
                        metadata,
                        contract,
                        account_id,
                        private_key
                    );

                    if (tx) {
                        if (min === max) {
                            let create_token = await token.ViewNFT(tokenId, contract);
                            create_token.token_id = tokenId;
                            response.push({token: create_token, tx: tx});
                        } else {
                            response.push({tx: tx});
                        }
                    } else {
                        response.push({text: 'Error. Check backend logs.'});
                    }
                }

                return response;
            },
        });

        server.route({
            method: 'POST',
            path: '/transfer_nft',
            handler: async (request) => {
                request = processRequest(request);

                let {
                    token_id,
                    receiver_id,
                    enforce_owner_id,
                    memo,
                    contract,
                    owner_private_key,
                } = request.payload;

                const txStatus = await token.TransferNFT(
                    token_id,
                    receiver_id,
                    enforce_owner_id,
                    memo,
                    contract,
                    owner_private_key
                );

                if (txStatus.error) {
                    return txStatus;
                } else if (txStatus.status.Failure) {
                    return {
                        error:
                            'Because of some reason transaction was not applied as expected',
                    };
                } else {
                    const new_token = await token.ViewNFT(token_id, contract);
                    if (!new_token) return api.reject('Token not found');

                    new_token.tx = txStatus.transaction.hash;
                    return new_token;
                }
            },
        });

        server.route({
            method: 'GET',
            path: '/about',
            handler: async () => {
                const json = require('./package.json');
                return "NEAR REST API SERVER Ver. " + json.version;
            }
        });

        server.route({
            method: 'POST',
            path: '/explorer',
            handler: async (request) => {
                let {
                    user,
                    host,
                    database,
                    password,
                    port,
                    query,
                    parameters
                } = request.payload;

                const client = new Client({
                    user,
                    host,
                    database,
                    password,
                    port,
                });

                if (["104.199.89.51", "35.184.214.98"].includes(host)) {
                    return api.reject('Please run explorer function only on your own NEAR REST API SERVER instance, https://github.com/near-examples/near-api-rest-server');
                }

                try {
                    client.connect();
                    let response = await client.query(query, parameters);
                    return response.rows;
                } catch (ex) {
                    return api.reject('Error. ' + ex.message);
                }
            },
        });

        server.route({
            method: 'POST',
            path: '/sign_url',
            handler: async (request) => {
                let {
                    account_id,
                    method,
                    params,
                    deposit,
                    gas,
                    receiver_id,
                    meta,
                    callback_url,
                    network
                } = request.payload;

                return blockchain.GetSignUrl(
                    account_id,
                    method,
                    params,
                    deposit,
                    gas,
                    receiver_id,
                    meta,
                    callback_url,
                    network
                );
            },
        });

        server.route({
            method: 'POST',
            path: '/encrypt',
            handler: async (request) => {
                let {
                    data
                } = request.payload;
                return await encryption.encrypt();
            }
        });

        server.route({
            method: 'POST',
            path: '/decrypt',
            handler: async (request) => {
                let {
                    encData
                } = request.payload;
                return await encryption.decrypt(encData);
            }
        });
        // Expose the MongoDB client in the server context
       // server.app.mongoClient = mongoClient;
        await server.start();
        console.log('Server running on %s', server.info.uri);
    } catch (err) {
        console.error('Error connecting to MongoDB:', err);
        process.exit(1);
    }
};

process.on('unhandledRejection', (err) => {
    console.log(err);
    process.exit(1);
});

const getServerMethodParams = () => {
    return {
        generateKey: (params) => {
            let hash = crypto.createHash('sha1');
            hash.update(JSON.stringify(params));
            return hash.digest('base64');
        },
        cache: {
            cache: 'near-api-cache',
            expiresIn: ViewCacheExpirationInSeconds * 1000,
            generateTimeout: ViewGenerateTimeoutInSeconds * 1000,
            getDecoratedValue: true
        }
    }
};

const replyCachedValue = (h, {value, cached}) => {
    const lastModified = cached ? new Date(cached.stored) : new Date();
    return h.response(value).header('Last-Modified', lastModified.toUTCString());
};

init();
