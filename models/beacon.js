import mongoose from "mongoose";

import LocationSchema from "./location.js";
import { UserSchema } from "./user.js";

const { Schema, model } = mongoose;

const beaconSchema = new Schema(
    {
        title: String,
        shortcode: { type: String, required: true },
        startsAt: { type: Date, default: Date.now },
        expiresAt: { type: Date, required: true },
        leader: { type: [UserSchema], required: true },
        followers: [UserSchema],
        route: [LocationSchema],
    },
    {
        timestamps: true,
    }
);

export default model("Beacon", beaconSchema, "Beacons"); // specify collection name
