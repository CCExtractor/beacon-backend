import mongoose from "mongoose";

const { Schema } = mongoose;

const locationSchema = new Schema(
    {
        lat: String,
        lon: String,
    },
    {
        timestamps: true,
    }
);

export default locationSchema;
