import mongoose from "mongoose";

const { Schema, model } = mongoose;

const userSchema = new Schema(
    {
        name: String,
        email: String,
        password: String,
        location: String,
        beacons: [String], // change to BeaconSchema later
        landmarks: [String], // change to LandmarkSchema later
    },
    {
        timestamps: true,
    }
);

export default model("User", userSchema, "Users"); // specify collection name
