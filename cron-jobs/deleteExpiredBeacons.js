const cron = require("node-cron");
const Beacon = require("../models/beacon.js");
const { User } = require("../models/user.js");
const Landmark = require("../models/landmark.js");
const Group = require("../models/group.js");

module.exports = {
    init() {
        // scheduling deleteExpiredBeacons for 1 am daily
        cron.schedule("0 1 * * *", async () => {
            await deleteExpiredBeacons();
        });
    },
};

async function deleteExpiredBeacons() {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        let oldBeacons = await Beacon.find({ expiresAt: { $lt: thirtyDaysAgo } });

        let groupBeaconsMap = new Map();
        let userBeaconsMap = new Map();
        let groupIds = [];
        let leaderIds = [];

        // create a map of string and list<string>
        // the key value is of groupId and value is list of beacons id
        // we will use this to delete the beacons id from group
        oldBeacons.forEach(({ group, id }) => {
            groupIds.push(group);
            const existingBeacons = groupBeaconsMap.get(group) || [];
            existingBeacons.push(id);
            groupBeaconsMap.set(group, existingBeacons);
        });

        // create a map<string,list<string>>
        // the key value is of beacon creator and value is list of beacons ids
        // we will use this to delete the beacons id from group
        oldBeacons.forEach(({ leader, id }) => {
            leaderIds.push(leader);
            const existingBeacons = userBeaconsMap.get(leader) || [];
            existingBeacons.push(id);
            userBeaconsMap.set(leader, existingBeacons);
        });
        groupIds = [...Set(groupIds)];
        leaderIds = [...Set(leaderIds)];

        let beaconIds = oldBeacons.map(beacon => beacon.id);

        // Deleting all old beacons
        for (const beaconId of beaconIds) {
            await Beacon.findByIdAndDelete(beaconId);
        }

        // Deleting landmarks associated with old beacons
        for (const beaconId of beaconIds) {
            await Landmark.deleteMany({ beaconId: { $in: [beaconId] } });
        }

        // deleting beacon id from group model
        for (const groupId of groupIds) {
            const beaconIdsToRemove = groupBeaconsMap.get(groupId) || [];
            await Group.findByIdAndUpdate(groupId, { $pull: { beacons: { $in: beaconIdsToRemove } } }, { new: true });
        }

        // deleting beacon id from user model
        for (const leaderId of leaderIds) {
            const beaconIdsToRemove = userBeaconsMap.get(leaderId) || [];
            await User.findByIdAndUpdate(leaderId, { $pull: { beacons: { $in: beaconIdsToRemove } } }, { new: true });
        }
    } catch (error) {
        console.error("Error deleting expired beacons:", error);
    }
}
