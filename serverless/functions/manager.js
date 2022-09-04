// manages ec2 start stop for beacon subscriptions
const { StartInstancesCommand, StopInstancesCommand, DescribeInstancesCommand } = require("@aws-sdk/client-ec2");
const { ec2Client } = require("../utils");
const mongoose = require("mongoose");
const Beacon = require("../../models/beacon.js");
require("dotenv").config();

let conn = null;
const params = { InstanceIds: [process.env.INSTANCE] }; // ec2 instance ID

const uri = process.env.DB;
const options = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    bufferCommands: false,
};

const manageInstance = async () => {
    const status = await ec2Client.send(new DescribeInstancesCommand(params));
    const instances = status["Reservations"][0]["Instances"];
    let state;
    for (let i = 0; i < instances.length; i++) {
        if (instances[i]["InstanceId"] === process.env.INSTANCE) {
            state = instances[i]["State"]["Name"];
            break;
        }
    }
    if (state == undefined) {
        console.log("Error", "Wrong instance ID");
        return;
    }
    const currentTime = new Date();
    const beacons = await Beacon.find({
        $or: [{ startsAt: { $gte: currentTime } }, { expiresAt: { $gte: currentTime } }],
    })
        .sort("startsAt")
        .select("startsAt")
        .select("expiresAt");
    console.log("Beacons: ", beacons);
    // TODO: implement start/stop that covers edges
    // get the earliest start and end
    const earliestStart = Math.min.apply(
        Math,
        beacons.map(function (o) {
            return o.startsAt;
        })
    );
    const latestEnd = Math.max.apply(
        Math,
        beacons.map(function (o) {
            return o.expiresAt;
        })
    );
    if (state === "stopped") {
        const startDiff = earliestStart - currentTime;
        if (startDiff < 300000) {
            // 5m in ms
            const data = await ec2Client.send(new StartInstancesCommand(params));
            console.log("started instance", data.StartingInstances);
            return data;
        }
    }
    if (latestEnd < currentTime) {
        const data = await ec2Client.send(new StopInstancesCommand(params));
        console.log("ended instance", data.StoppingInstances);
        return data;
    }
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
        const resp = await manageInstance();
        return resp;
    } catch (err) {
        console.log("Error", err);
        throw err;
    }
};
