const mongoose = require("mongoose");

//Model for user details.
const userSchema = new mongoose.Schema(
	{
        
        account_id: {
			type: String,
		},
		walletAddress: {
			type: String,
		},
		privateKey: {
			type: String,
		},
		isDisabled: {
			type: Number,
		},
	},
	{
		timestamps: true,
	},
);

//Exporting file and set collection name user.
module.exports = mongoose.model("users", userSchema);