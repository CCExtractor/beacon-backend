import mongoose from "mongoose";

const { Schema } = mongoose;

const locationSchema = new Schema(
    {
        lat: { type: String, required: true },
        lon: { type: String, required: true },
    },
    {
        timestamps: true,
    }
);

export default locationSchema;
