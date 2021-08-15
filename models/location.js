const mongoose = require("mongoose");

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

module.exports = locationSchema;
