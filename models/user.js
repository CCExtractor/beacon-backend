import mongoose from "mongoose";

import LocationSchema from "./location.js";

const { Schema, model } = mongoose;

export const UserSchema = new Schema(
    {
        name: String,
        email: String,
        password: String,
        location: [LocationSchema],
        beacons: [String], // change to BeaconSchema later
        landmarks: [String], // change to LandmarkSchema later
    },
    {
        timestamps: true,
    }
);

export const User = model("User", UserSchema, "Users"); // specify collection name
