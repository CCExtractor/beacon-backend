const mongoose = require("mongoose");

const LocationSchema = require("./location.js");
const { UserSchema } = require("./user.js");

const { Schema, model } = mongoose;

const beaconSchema = new Schema(
    {
        title: String,
        shortcode: { type: String, required: true },
        startsAt: { type: Date, default: Date.now },
        expiresAt: { type: Date, required: true },
        leader: { type: Schema.Types.ObjectId, required: true, ref: "User" },
        showAdminName: { type: Boolean, default: false },
        location: LocationSchema,
        followers: [UserSchema],
        route: [LocationSchema],
        landmarks: { type: [Schema.Types.ObjectId], ref: "Landmark" },
        group: { type: Schema.Types.ObjectId, ref: "Group" },
    },
    {
        timestamps: true,
    }
);

module.exports = model("Beacon", beaconSchema, "Beacons"); // specify collection name
