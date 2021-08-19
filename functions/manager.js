// manages ec2 start stop for beacon subscriptions
const { StartInstancesCommand, StopInstancesCommand } = require("@aws-sdk/client-ec2");
const { ec2Client } = require("../utils");
const mongoose = require("mongoose");
const { Beacon } = require("../models/beacon.js");
require("dotenv").config();

let conn = null;
const params = { InstanceIds: ["INSTANCE_ID"] }; // ec2 instance ID

const uri = process.env.DB;
const options = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    bufferCommands: false,
};

const manageInstance = async state => {
    const currentTime = new Date();
    const beacons = Beacon.find({ $or: [{ startsAt: { $gte: currentTime } }, { expiresAt: { $gte: currentTime } }] })
        .sort("startsAt")
        .select("startsAt")
        .select("expiresAt");
    // TODO: implement start/stop that covers edges
};

exports.handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    if (!conn) {
        console.log("connecting to db");
        conn = mongoose.connect(uri, options).then(() => mongoose);
        console.log("just connected to db");
        await conn;
    }
    try {
        const data = await ec2Client.send(new StartInstancesCommand(params));
        console.log("Success", data.StartingInstances);
        return data;
    } catch (err) {
        console.log("Error2", err);
    }
};
