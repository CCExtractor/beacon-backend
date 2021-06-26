import mongoose from "mongoose";

import LocationSchema from "./location.js";

const { Schema, model } = mongoose;

const beaconSchema = new Schema(
    {
        title: String,
        shortcode: { type: String, required: true },
        startsAt: { type: Date, default: Date.now },
        expiresAt: { type: Date, required: true },
        leader: { type: mongoose.ObjectId, required: true },
        followers: [mongoose.ObjectId],
        route: [LocationSchema],
    },
    {
        timestamps: true,
    }
);

export default model("Beacon", beaconSchema, "Beacons"); // specify collection name
