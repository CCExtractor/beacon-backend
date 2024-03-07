const mongoose = require("mongoose");

const LocationSchema = require("./location.js");

const { Schema, model } = mongoose;

const UserSchema = new Schema(
    {
        name: String,
        email: String,
        password: String,
        // store most recent location
        location: LocationSchema,
        beacons: { type: [Schema.Types.ObjectId], ref: "Beacon" },
        groups: { type: [Schema.Types.ObjectId], ref: "Group" },
        // user status - ONLINE or OFFLINE
        status: { type: String, default: "ONLINE" },
    },
    {
        timestamps: true,
    }
);

module.exports = { UserSchema, User: model("User", UserSchema, "Users") }; // specify collection name
