const mongoose = require("mongoose");

const { Schema, model } = mongoose;

const groupSchema = new Schema(
    {
        title: String,
        shortcode: { type: String, required: true, unique: true },
        leader: { type: Schema.Types.ObjectId, required: true, ref: "User" },
        members: { type: [Schema.Types.ObjectId], ref: "User", default: [] },
        beacons: { type: [Schema.Types.ObjectId], ref: "Beacon", default: [] },
    },
    {
        timestamps: true,
    }
);

module.exports = model("Group", groupSchema, "Groups");
