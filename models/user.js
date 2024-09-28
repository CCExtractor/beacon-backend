const mongoose = require("mongoose");

const LocationSchema = require("./location.js");

const { Schema, model } = mongoose;

const UserSchema = new Schema(
    {
        name: String,
        email: String,
        password: String,
        // store most recent location
        isVerified: { type: Boolean, default: false },
        location: LocationSchema,
        beacons: { type: [Schema.Types.ObjectId], ref: "Beacon", default: [] },
        groups: { type: [Schema.Types.ObjectId], ref: "Group", default: [] },
    },
    {
        timestamps: true,
    }
);

module.exports = { UserSchema, User: model("User", UserSchema, "Users") }; // specify collection name
