const mongoose = require("mongoose");

const { Schema } = mongoose;

const locationSchema = new Schema(
    {
        lat: String,
        lon: String,
    },
    {
        _id: false,
        timestamps: false,
    }
);

module.exports = locationSchema;
