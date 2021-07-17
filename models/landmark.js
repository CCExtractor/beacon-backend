import mongoose from "mongoose";

import LocationSchema from "./location.js";

const { Schema, model } = mongoose;

const landmarkSchema = new Schema(
    {
        title: { type: String, required: true },
        location: { type: LocationSchema, required: true },
        createdBy: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    },
    {
        timestamps: true,
    }
);

export default model("Landmark", landmarkSchema, "Landmarks"); // specify collection name
