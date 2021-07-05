import mongoose from "mongoose";

import LocationSchema from "./location.js";

const { Schema, model } = mongoose;

export const UserSchema = new Schema(
    {
        name: String,
        email: String,
        password: String,
        location: [LocationSchema],
        beacons: { type: [Schema.Types.ObjectId], ref: "Beacon" },
        landmarks: [String], // change to LandmarkSchema later
    },
    {
        timestamps: true,
    }
);

export const User = model("User", UserSchema, "Users"); // specify collection name
