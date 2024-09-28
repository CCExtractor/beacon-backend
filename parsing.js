const { default: mongoose } = require("mongoose");

function parseBeaconObject(beaconObject) {
    if (typeof beaconObject === "string") {
        return convertToObjectId(beaconObject);
    }

    var model = {
        _id: convertToObjectId(beaconObject._id),
        title: beaconObject.title,
        shortcode: beaconObject.shortcode,
        startsAt: convertToDate(beaconObject.startsAt),
        expiresAt: convertToDate(beaconObject.expiresAt),
        group: parseGroupObject(beaconObject.group),
        leader: parseUserObject(beaconObject.leader),
        location: beaconObject.location,
        followers: Array.isArray(beaconObject.followers)
            ? beaconObject.followers.map(follower => parseUserObject(follower))
            : [],
        landmarks: Array.isArray(beaconObject.landmarks)
            ? beaconObject.landmarks.map(landmark => parseLandmarkObject(landmark))
            : [],
        route: beaconObject.route.map(single => parseLocationObject(single)),
        geofence: beaconObject.geofence,

        updatedAt: convertToDate(beaconObject.updatedAt),
        __v: beaconObject.__v,
    };

    return model;
}

function parseUserObject(userObject) {
    if (typeof userObject === "string") {
        return convertToObjectId(userObject);
    }

    try {
        var model = {
            _id: convertToObjectId(userObject._id),
            name: userObject.name,
            email: userObject.email,
            password: userObject.password,
            groups: Array.isArray(userObject.groups) ? userObject.groups.map(group => parseGroupObject(group)) : [],
            beacons: Array.isArray(userObject.beacons)
                ? userObject.beacons.map(beacon => parseBeaconObject(beacon))
                : [],
            location: userObject.location,
            createdAt: convertToDate(userObject.createdAt),
            updatedAt: convertToDate(userObject.updatedAt),
            __v: userObject.__v,
        };
    } catch (error) {
        console.log(error)
    }

    return model;
}

function parseGroupObject(groupObject) {
    if (typeof groupObject === "string") {
        return convertToObjectId(groupObject);
    }

    var model = {
        _id: convertToObjectId(groupObject._id),
        title: groupObject.title,
        shortcode: groupObject.shortcode,
        createdAt: new Date(groupObject.createdAt),
        updatedAt: new Date(groupObject.updatedAtt),
        leader: parseUserObject(groupObject.leader),
        members: Array.isArray(groupObject.members) ? groupObject.members.map(member => parseUserObject(member)) : [],
        beacons: Array.isArray(groupObject.beacons) ? groupObject.beacons.map(beacon => parseBeaconObject(beacon)) : [],
        __v: groupObject.__v,
    };

    return model;
}

function parseLandmarkObject(landmarkObject) {
    if (typeof landmarkObject === "string") {
        return convertToObjectId(landmarkObject);
    }

    var model = {
        _id: convertToObjectId(landmarkObject._id),
        title: landmarkObject.title,
        location: parseLocationObject(landmarkObject.location),
        createdBy: parseUserObject(landmarkObject.createdBy),
        createdAt: convertToDate(landmarkObject.createdAt),
        updatedAt: convertToDate(landmarkObject.updatedAt),
        __v: landmarkObject.__v,
    };

    return model;
}

function parseLocationObject(locationObject) {
    console.log(JSON.stringify(locationObject));
    if (locationObject == null) return undefined;

    var model = {
        lat: locationObject.lat,
        lon: locationObject.lon,
    };

    return model;
}

function convertToObjectId(id) {
    return new mongoose.Types.ObjectId(id);
}

function convertToDate(date) {
    return new Date(date);
}

module.exports = {
    parseUserObject,
    parseBeaconObject,
    parseLandmarkObject,
    parseLocationObject,
    parseGroupObject,
    convertToObjectId,
    convertToDate,
};
