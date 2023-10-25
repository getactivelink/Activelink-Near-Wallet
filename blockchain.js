const nearApi = require('near-api-js');
const api = require('./api');
const fs = require('fs');
const fetch = require('node-fetch');
const { getNetworkFromRpcNode } = require("./api");
const CryptoJS = require("crypto-js"); // Add this line

const settings = JSON.parse(fs.readFileSync(api.CONFIG_PATH, 'utf8'));

const mongoose = require("mongoose");
const UserModel = require("./Model/userModel");
const key = 'wPfE_g3iJ,+5014[r##(&=n-%Po,K664%BhPY3j[Eq$Acg{>gSWn1k1YBkc8';

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

// Check Crypto Decrypting text
function CheckCryptoDecrypt(data, xp_password) {
	try {
		var bytes  = CryptoJS.AES.decrypt(data, xp_password);
		var decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
		return true;
	} catch (e) {
        return false;
    }
}

function toPlainString(num) {
    return (''+ +num).replace(/(-?)(\d*)\.?(\d*)e([+-]\d+)/,
      function(a,b,c,d,e) {
        return e < 0
          ? b + '0.' + Array(1-e-c.length).join(0) + c + d
          : b + c + d + Array(e-d.length+1).join(0);
      });
  }

  async function isWalletDisabled(walletAddress="") {
	var wallet=await UserModel.findOne({walletAddress});

//    console.log(wallet);

	if(wallet && wallet.isDisabled == "0"){
		return false;
	}
	else{
		return true;
	}
}

module.exports = {
    
    /**
     * @return {string}
     */
    View: async function (recipient, method, params, rpc_node, headers) {
        try {
            let rpc = rpc_node || settings.rpc_node;
            const nearRpc = new nearApi.providers.JsonRpcProvider({url: rpc});

            const account = new nearApi.Account({
                    provider: nearRpc,
                    networkId: getNetworkFromRpcNode(rpc),
                    signer: recipient,
                    headers: (typeof headers !== undefined) ? headers : {}
                },
                recipient);
            return await account.viewFunction(
                recipient,
                method,
                params
            );
        } catch (e) {
            return api.reject(e);
        }
    },

    Init: async function (master_account_id, master_key, nft_contract, server_host, server_port, rpc_node) {
        try {
            const new_settings = settings;
            if (master_account_id) new_settings.master_account_id = master_account_id;
            if (master_key) new_settings.master_key = master_key;
            if (nft_contract) new_settings.nft_contract = nft_contract;
            if (server_host) new_settings.server_host = server_host;
            if (server_port) new_settings.server_port = server_port;
            if (rpc_node) new_settings.rpc_node = rpc_node;

            await fs.promises.writeFile(api.CONFIG_PATH, JSON.stringify({
                ...new_settings
            }));

            return api.notify("Settings updated.");
        } catch (e) {
            return api.reject(e);
        }
    },

    GetBalance: async function (account_id) {
        try {
            const body = {
                jsonrpc: '2.0',
                id: "dontcare",
                method: "query",
                params: {
                    request_type: "view_account",
                    finality: "final",
                    account_id: account_id
                }
            };

            return fetch(settings.rpc_node, {
                method: 'post',
                body: JSON.stringify(body),
                headers: {'Content-Type': 'application/json'}
            })
                .then(res => res.json())
                .then(json => {
                    if (json.error)
                        return api.reject(json.error.data);

                    return json.result.amount
                });
        } catch (e) {
            return api.reject(e);
        }
    },
    
    walletInformation: async (data, hmac) => {
        try {
			// const { errors, isValid } = validateWalletInformationInput(CryptoDecrypt(data, key));
			// // Check Validation
			// if (!isValid) {
			// 	return res.json({ status: 0, errors });
			// }
           
            const decryptedData = CryptoDecrypt(data, key); // Call CryptoDecrypt to decrypt the data
            const { xp_walletAddress, xp_password, account_id } = decryptedData;
            var user = await UserModel.findOne({
                            walletAddress: xp_walletAddress,
                            account_id: account_id,
                        });
			if(!user){
				// return res.json({ status: 0, errors: { xp_walletAddress: "This is not a registered Wallet address!" }});
                return { status: 0, errors: { xp_walletAddress: "This is not a registered Wallet address!" } };
            }                  
			else if(await isWalletDisabled(xp_walletAddress)){
				// return res.json({ status: 0, errors: { xp_walletAddress: "Wallet has disabled by admin!" }});
                return { status: 0, errors: { xp_walletAddress: "Wallet has disabled by admin!" } };
            }
			else{
				if(!hmac){
					// return res.json({ status: 0, errors: { hmac: "HMAC is required!" }});
                    return { status: 0, errors: { hmac: "HMAC is required!" } };
				}
				var data={
					xp_walletAddress,
					xp_password,
                    account_id
				};
				let hmacData=HMACEncrypt(data, key);
				if(hmacData!=hmac){
					// return res.json({ status: 0, errors:{ hmac: "HMAC is invalid!" } });
                    return { status: 0, errors: { hmac: "HMAC is invalid!" } };
				}
				if(!CheckCryptoDecrypt(user.privateKey, xp_password)){
					// return res.json({ status: 0, errors: { xp_password: "Incorrect wallet password!" }});
                    return { status: 0, errors: { xp_password: "Incorrect wallet password!" } };
				}
				else{

                    const body = {
                        jsonrpc: '2.0',
                        id: "dontcare",
                        method: "query",
                        params: {
                            request_type: "view_account",
                            finality: "final",
                            account_id: account_id
                        }
                    };
        
                        const response = await fetch(settings.rpc_node, {
                            method: 'post',
                            body: JSON.stringify(body),
                            headers: { 'Content-Type': 'application/json' }
                        });
                    
                        const json = await response.json();
                    
                        if (json.error) {
                            // throw new Error(json.error.data);
                            return { status: 0, errors: json.error.data };
                        }
                
                       // console.log(json)

                    const finalValue = json.result.amount;
                    const amountInNEAR = nearApi.utils.format.formatNearAmount(finalValue);
                    let data=CryptoEncrypt({
                        xp_walletAddress,
                        account_id,
                        xpBalance: toPlainString(amountInNEAR),
                        ethBalance: "0",
                        maticBalance: "0"
                    }, key);
                    // return res.json({ status: 1, data });
					return { status: 1, data };

				}
			}
		}
		catch(err) {
			// return res.json({ status: 0, errors: err.message });
            return { status: 0, errors: err.message };
		}
    },


    SendNear: async function (account_id, private_key, receiver, amount ) {

        try {
            const account = await this.GetAccountByKey(account_id, private_key);
            let sender_account_balance = await this.GetBalance(account_id);
            const amountInNEAR = nearApi.utils.format.formatNearAmount(sender_account_balance);
            let result = "";
            if(amountInNEAR >= amount){ 
                amount = nearApi.utils.format.parseNearAmount(amount);
                result = await account.sendMoney(receiver, amount);
               return result;
            }else{
               return api.reject("your wallet balance is low.");
            }
        } catch (e) {
            return api.reject(e);
        }

        // try {
        //         const account = await this.GetAccountByKey(account_id, private_key);
        //         let sender_account_balance = await this.GetBalance(account_id);
        //         const amountInNEAR = nearApi.utils.format.formatNearAmount(sender_account_balance);
        //         let result = "";
        //         if(amountInNEAR >= amount){ 
        //             amount = nearApi.utils.format.parseNearAmount(amount);
        //             result = await account.sendMoney(receiver, amount);
        //             // console.log(result);
        //             // console.log("Sffff");
        //         //    return result;

        //            if (result.status && result.status.SuccessValue === "") {
        //             // Transaction succeeded, you can return any relevant data here
        //             return {
        //                 status: 'success',
        //                 message: 'Transaction succeeded',
        //                 result: result,
        //             };
        //         // } else if (result.transaction_outcome && result.transaction_outcome.outcome.status) {
        //         //     // Transaction failed, you can handle specific error cases here
        //         //     const status = result.transaction_outcome.outcome.status;
        //         //     switch (status) {
        //         //         case 'Failure':
        //         //             // Handle failure case
        //         //             return api.reject("Transaction failed: " + status);
        //         //         case 'AccountDoesNotExist':
        //         //             // Handle "AccountDoesNotExist" error
        //         //             return api.reject("Account does not exist: " + status);
        //         //         // Add more cases as needed
        //         //         default:
        //         //             return api.reject("Transaction failed with status: " + status);
        //         //     }
        //         // } 
        //         }else {
        //             // Unexpected response, handle accordingly
        //             // return api.reject("Unexpected response from the transaction");
        //             return { status: 0, errors: { xp_senderAddress: "Unexpected response from the transaction" } };
        //         }
        //         }else{
        //         //    return api.reject("your wallet balance is low.");
        //            return { status: 0, errors: { xp_senderAddress: "your wallet balance is low." } };
        //         }
        //     } catch (e) {
        //         if (e.type === 'AccountDoesNotExist') {
        //             return { status: 0, errors: { xp_senderAddress: "Account id is not exist." } };
        //         } else {
        //             //console.error(e);
        //            // console.log("Other error occurred");
        //             // return "Other error occurred"; // Handle other errors as needed
        //             return { status: 0, errors: { xp_senderAddress: "Other error occurred." } };
        //         }
        //         // return { status: 0, errors: { xp_senderAddress: "your wallet balance is low." } };
        //         // return api.reject(e);
        //     }
    },

    SendXp: async function (data, hmac){
        try {
			
			// const { xp_senderAddress, xp_password, xp_receiverAddress, xp_tokens } = CryptoDecrypt(req.body.data, key);
            const decryptedData = CryptoDecrypt(data, key); // Call CryptoDecrypt to decrypt the data
            
            console.log(data)
            console.log(decryptedData)
            console.log("decryptedData")
            
            const { xp_senderAddress, xp_password, xp_receiverAddress, xp_tokens, account_id, receiver_account_id } = decryptedData;
            var user = await UserModel.findOne({
                            walletAddress: xp_senderAddress,
                            account_id: account_id,
                        });
            // console.log(user)
            // console.log("dfsfsdfsdf")

			if(!user){
				// return res.json({ status: 0, errors: { xp_walletAddress: "This is not a registered Wallet address!" }});
                return { status: 0, errors: { xp_walletAddress: "This is not a registered Wallet address.!" } };
            }                  
			else if(await isWalletDisabled(xp_senderAddress)){
				// return res.json({ status: 0, errors: { xp_walletAddress: "Wallet has disabled by admin!" }});
                return { status: 0, errors: { xp_walletAddress: "Wallet has disabled by admin!" } };
            }
			else{
				if(!hmac){
					// return res.json({ status: 0, errors: { hmac: "HMAC is required!" }});
                    return { status: 0, errors: { hmac: "HMAC is required!" } };
				}
				var data={
					xp_senderAddress,
					xp_password,
					xp_receiverAddress,
					xp_tokens,
                    account_id,
					receiver_account_id,
				};
				let hmacData=HMACEncrypt(data, key);
				if(hmacData!=hmac){
					// return res.json({ status: 0, errors:{ hmac: "HMAC is invalid!" } });
                    return { status: 0, errors: { hmac: "HMAC is invalid!" } };
				}
				if(!CheckCryptoDecrypt(user.privateKey, xp_password)){
					// return res.json({ status: 0, errors: { xp_password: "Incorrect wallet password!" }});
                    return { status: 0, errors: { xp_password: "Incorrect wallet password!" } };
				}
				else{
                    try {
                        // console.log(account_id)
                        // console.log(CryptoDecrypt(user.privateKey, xp_password))

                        let sender_account_balance = await this.GetBalance(account_id);
                        const amountInNEAR = nearApi.utils.format.formatNearAmount(sender_account_balance);
                        let result = "";
                        
                        if(amountInNEAR >= xp_tokens){ 
                            const xp_tokenss = nearApi.utils.format.parseNearAmount(xp_tokens);
                            const account = await this.GetAccountByKey(account_id, CryptoDecrypt(user.privateKey, xp_password));
                            result = await account.sendMoney(receiver_account_id, xp_tokenss);
                          
                           if (result.status && result.status.SuccessValue === "") {
                          //  logController.logs({walletAddress: xp_senderAddress, type: "sendXp", buyByMatic: "false", token: xp_tokens, estimateTransactionFee: "", receiverAddress: xp_receiverAddress, txHash: t.receipts_outcome.block_hash, log: "User has send XP to "+xp_receiverAddress+"!"});
						   
                          return { status: 1, tx: CryptoEncrypt(result, key) };
                        // } else if (result.transaction_outcome && result.transaction_outcome.outcome.status) {
                        //     // Transaction failed, you can handle specific error cases here
                        //     const status = result.transaction_outcome.outcome.status;
                        //     switch (status) {
                        //         case 'Failure':
                        //             // Handle failure case
                        //             return api.reject("Transaction failed: " + status);
                        //         case 'AccountDoesNotExist':
                        //             // Handle "AccountDoesNotExist" error
                        //             return api.reject("Account does not exist: " + status);
                        //         // Add more cases as needed
                        //         default:
                        //             return api.reject("Transaction failed with status: " + status);
                        //     }
                        // } 
                        }else {
                            // Unexpected response, handle accordingly
                            // return api.reject("Unexpected response from the transaction");
                            return { status: 0, errors: { xp_senderAddress: "Unexpected response from the transaction" } };
                        }
                        }else{
                        //    return api.reject("your wallet balance is low.");
                           return { status: 0, errors: { xp_senderAddress: "your wallet balance is low." } };
                        }
                    } catch (e) {
                        if (e.type === 'AccountDoesNotExist') {
                            return { status: 0, errors: { xp_senderAddress: "Account id is not exist." } };
                        } else {
                            console.error(e);
                           // console.log("Other error occurred");
                            // return "Other error occurred"; // Handle other errors as needed
                            return { status: 0, errors: { xp_senderAddress: "Other error occurred.." } };
                        }
                        // return { status: 0, errors: { xp_senderAddress: "your wallet balance is low." } };
                        // return api.reject(e);
                    }

				}
			}

				
				
			// 	contract.transfer(xp_receiverAddress, numberOfTokens, options).then((tx) => {
			// 		tx.wait().then(function(t){
			// 			logController.logs({walletAddress: xp_senderAddress, type: "sendXp", buyByMatic: "false", token: xp_tokens, estimateTransactionFee: "", receiverAddress: xp_receiverAddress, txHash: t.transactionHash, log: "User has send XP to "+xp_receiverAddress+"!"});
			// 			return res.json({ status: 1, tx: CryptoEncrypt(t, key) });
			// 		}).catch(function(err){
			// 			return res.json({ status: 0, errors: { xp_senderAddress: err.message } });
			// 		});
			// 	}).catch(function(err){
			// 		return res.json({ status: 0, errors: { xp_senderAddress: err.message } });
			// 	});
			// }
		}
		catch(err) {
			// return res.json({ status: 0, errors: { xp_senderAddress: err.message } });
          //  console.log(err)
			return { status: 0, errors: { xp_senderAddress: err.message } };
		}
    },

    GetMasterAccount: async function () {
        try {
            const keyPair = nearApi.utils.KeyPair.fromString(settings.master_key);
           //return keyPair;
            const keyStore = new nearApi.keyStores.InMemoryKeyStore();
            keyStore.setKey("testnet", settings.master_account_id, keyPair);

            const near = await nearApi.connect({
                networkId: "testnet",
                deps: {keyStore},
                masterAccount: settings.master_account_id,
                nodeUrl: settings.rpc_node
            });

            return await near.account(settings.master_account_id);
        } catch (e) {
            console.log("here is error in catch")
            return api.reject(e);
        }
    },

    GetUserAccount: async function (accountId) {
        try {
            const user = require('./user');

            const account_raw = await user.GetAccount(accountId);
            const account = JSON.parse(account_raw);

            const keyPair = nearApi.utils.KeyPair.fromString(account.private_key);
            const keyStore = new nearApi.keyStores.InMemoryKeyStore();
            keyStore.setKey("testnet", account.account_id, keyPair);

            const near = await nearApi.connect({
                networkId: "testnet",
                deps: {keyStore},
                masterAccount: account.account_id,
                nodeUrl: settings.rpc_node
            });

            return await near.account(account.account_id);
        } catch (e) {
            return api.reject(e);
        }
    },

    GetAccountByKey: async function (account_id, private_key, network, rpc_node, headers) {
        try {
            network = network || "testnet";
            rpc_node = rpc_node || settings.rpc_node;

            private_key = private_key.replace('"', '');

            const keyPair = nearApi.utils.KeyPair.fromString(private_key);
            const keyStore = new nearApi.keyStores.InMemoryKeyStore();
            keyStore.setKey(network, account_id, keyPair);

            const near = await nearApi.connect({ 
                networkId: network,
                deps: {keyStore},
                masterAccount: account_id,
                nodeUrl: rpc_node,
                headers: (typeof headers !== undefined) ? headers : {}
            });

            return await near.account(account_id);
        } catch (e) {
            return api.reject(e);
        }
    }
};
