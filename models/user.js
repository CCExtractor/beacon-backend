import mongoose from "mongoose";

import LocationSchema from "./location.js";

const { Schema, model } = mongoose;

const userSchema = new Schema(
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

export default model("User", userSchema, "Users"); // specify collection name
