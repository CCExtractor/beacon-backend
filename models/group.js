const mongoose = require("mongoose");

const { Schema, model } = mongoose;

const groupSchema = new Schema(
    {
        title: String,
        shortcode: { type: String, required: true },
        leader: { type: Schema.Types.ObjectId, required: true, ref: "User" },
        members: { type: [Schema.Types.ObjectId], ref: "User" },
        beacons: { type: [Schema.Types.ObjectId], ref: "Beacon" },
    },
    {
        timestamps: true,
    }
);

module.exports = model("Group", groupSchema, "Groups");
