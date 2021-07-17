import mongoose from "mongoose";

import LocationSchema from "./location.js";

const { Schema, model } = mongoose;

export const UserSchema = new Schema(
    {
        name: String,
        email: String,
        password: String,
        // store most recent location
        location: LocationSchema,
        beacons: { type: [Schema.Types.ObjectId], ref: "Beacon" },
        landmarks: { type: [Schema.Types.ObjectId], ref: "Landmark" },
    },
    {
        timestamps: true,
    }
);

export const User = model("User", UserSchema, "Users"); // specify collection name
