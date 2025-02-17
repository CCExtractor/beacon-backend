const { AuthenticationError, UserInputError, withFilter } = require("apollo-server-express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { customAlphabet } = require("nanoid");
const geolib = require("geolib");
const { isPointWithinRadius } = geolib;
const Beacon = require("../models/beacon.js");
const Group = require("../models/group.js");
const Landmark = require("../models/landmark.js");
const { User } = require("../models/user.js");
const { MongoServerError } = require("mongodb");
const { parseBeaconObject, parseUserObject, parseLandmarkObject } = require("../parsing.js");
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
// even if we generate 10 IDs per hour,
// ~10 days needed, in order to have a 1% probability of at least one collision.
const nanoid = customAlphabet(alphabet, 6);
const nodemailer = require("nodemailer");

const resolvers = {
    Query: {
        hello: () => "Hello world!",
        me: async (_parent, _args, { user }) => {
            const _user = await User.findById(user.id);
            return _user;
        },
        beacon: async (_parent, { id }, { user }) => {
            const beacon = await Beacon.findById(id)
                .populate("leader followers")
                .populate({
                    path: "landmarks",
                    populate: { path: "createdBy", select: "name email" },
                });
            if (!beacon) return new UserInputError("No beacon exists with that id.");
            // return error iff user not in beacon
            let flag = false;
            for (let i = 0; i < beacon.followers.length; i++)
                if (beacon.followers[i].id === user.id) {
                    flag = true;
                    break;
                }
            if (beacon.leader.id !== user.id && !flag) return new Error("User should be a part of beacon");

            return beacon;
        },
        group: async (_parent, { id }, { user }) => {
            const group = await Group.findById(id).populate("leader members");

            if (!group.leader._id.equals(user._id) && !group.members.some(member => member._id.equals(user._id)))
                return UserInputError("User should be part of group!");
            if (!group) return new UserInputError("No group exists with that id.");

            // Check if the user is part of the group
            if (group.leader.id !== user.id && !group.members.some(member => member.id === user.id))
                return UserInputError("User should be a part of the group");

            return group;
        },
        groups: async (_parent, { page, pageSize }, { user }) => {
            if (!user.groups) return Error(`User have no groups!`);

            let groups = await Group.find({ _id: { $in: user.groups } })
                .sort({ updatedAt: -1 })
                .skip((page - 1) * pageSize)
                .limit(pageSize)
                .populate("leader members")
                .lean();

            // it might be possible that group has been deleted
            groups = groups.filter(group => group !== null);

            return groups ?? [];
        },
        beacons: async (_parent, { groupId, page, pageSize }, { user }) => {
            const group = await Group.findById(groupId).select("beacons");

            if (!group) return new Error("This group doesn`t exist any more");

            if (!group.leader === user.id && !group.members.include(user.id))
                return Error("User should be part of group!");

            const hikeIds = group.beacons;

            const allHikes = await Beacon.find({ _id: { $in: hikeIds } })
                .populate("leader followers")
                .lean();

            const currentTime = new Date();

            const activeHikes = [];
            const upcomingHikes = [];
            const inactiveHikes = [];

            allHikes.forEach(hike => {
                if (hike.startsAt <= currentTime && hike.expiresAt >= currentTime) {
                    activeHikes.push(hike);
                } else if (hike.startsAt > currentTime) {
                    upcomingHikes.push(hike);
                } else {
                    inactiveHikes.push(hike);
                }
            });

            const sortedHikes = [...activeHikes, ...upcomingHikes, ...inactiveHikes];

            const paginatedHikes = sortedHikes.slice((page - 1) * pageSize, page * pageSize);

            return paginatedHikes;
        },
        filterBeacons: async (_, { id, type }, { user }) => {
            const group = await Group.findById(id);

            if (!group.leader === user.id && !group.members.include(user.id))
                return Error("User should be part of group!");

            const beaconIds = group.beacons;

            let beacons = await Beacon.find({ _id: { $in: beaconIds } }).populate("leader");

            if (type == "ACTIVE") {
                beacons = beacons.filter(beacon => {
                    return new Date(beacon.startsAt) <= new Date() && new Date() < new Date(beacon.expiresAt);
                });
            } else if (type == "INACTIVE") {
                beacons = beacons.filter(beacon => {
                    return new Date() > new Date(beacon.expiresAt);
                });
            } else if (type == "UPCOMING") {
                beacons = beacons.filter(beacon => {
                    return new Date() < new Date(beacon.startsAt);
                });
            }

            return beacons;
        },
        nearbyBeacons: async (_, { location, id, radius }, { user }) => {
            const group = await Group.findById(id);

            if (!group.leader === user.id && !group.members.include(user.id))
                return Error("User should be part of group!");

            const beaconIds = group.beacons;

            // get active beacons
            let beacons = await Beacon.find({ _id: { $in: beaconIds } }).populate("leader");

            const now = new Date();
            beacons = beacons.filter(beacon => {
                const expiresAt = new Date(beacon.expiresAt);
                return expiresAt > now;
            });

            let nearby = [];
            beacons.forEach(b => {
                // unpack to not pass extra db fields to function
                const { lat, lon } = b.location;
                if (isPointWithinRadius({ lat, lon }, location, radius)) nearby.push(b); // add beacons within 1.5km
            });

            return nearby;
        },
        landmarks: async (_parent, { beaconID }, { user }) => {
            const beacon = await Beacon.findById(beaconID).populate({
                path: "landmarks",
                populate: { path: "createdBy", select: "name email" },
            });

            if (!beacon) throw new UserInputError("No beacon exists with that ID");

            if (beacon.leader.toString() !== user.id && !beacon.followers.some(follower => follower.id === user.id)) {
                throw new AuthenticationError("user must be a part of the beacon to view landmarks");
            }

            return beacon.landmarks;
        },
    },

    Mutation: {
        register: async (_parent, { user }) => {
            const { name, credentials } = user;

            var currentUser = await User.findOne({ email: credentials.email });
            if (credentials && currentUser) return new UserInputError("User with email already registered.");

            const newUser = new User({
                name,
                // add email and password only if credentials exist
                ...(credentials && {
                    email: credentials.email,
                    password: await bcrypt.hash(credentials.password, 10),
                }),
            });

            const userObj = await newUser.save();
            return userObj;
        },

        oAuth: async (_parent, { userInput }) => {
            const { name, email } = userInput;
            let user = await User.findOne({ email });

            if (!user) {
                const newUser = new User({ name, email, isVerified: true });
                user = await newUser.save();
            }

            const anon = false;
            const tokenPayload = {
                "https://beacon.ccextractor.org": {
                    anon,
                    ...(email && { email }),
                },
            };

            const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
                algorithm: "HS256",
                subject: user._id.toString(),
                expiresIn: "7d",
            });

            return token;
        },

        login: async (_parent, { id, credentials }) => {
            if (!id && !credentials) return new UserInputError("One of ID and credentials required");

            const { email, password } = credentials || {}; // unpack if available
            const user = id ? await User.findById(id) : await User.findOne({ email });

            if (!user) return new Error("User not found.");

            // prevent third party using id to login when user registered
            if (user.email && !credentials) return new UserInputError("Email/password required to login");

            let anon = true;

            if (credentials) {
                const valid = email === user.email && (await bcrypt.compare(password, user.password));
                if (!valid) return new AuthenticationError("credentials don't match");
                anon = false;
            }

            return jwt.sign(
                {
                    "https://beacon.ccextractor.org": {
                        anon,
                        ...(email && { email }),
                    },
                },
                process.env.JWT_SECRET,
                {
                    algorithm: "HS256",
                    subject: user.id,
                    expiresIn: "7d",
                }
            );
        },

        sendVerificationCode: async (_, { email }) => {
            const min = 1000;
            const max = 9999;

            let verificationCode = Math.floor(Math.random() * (max - min + 1)) + min;
            const transporter = nodemailer.createTransport({
                service: "gmail",
                auth: {
                    user: process.env.EMAIL_USERNAME,
                    pass: process.env.EMAIL_PASSWORD,
                },
            });

            let mailOptions = {
                from: "Beacon",
                to: email,
                subject: `Verification code`,
                text: `Your verification code is: 
                                       ${verificationCode}`,
            };
            transporter.sendMail(mailOptions);

            return verificationCode;
        },
        completeVerification: async (_, { userId }, { user }) => {
            let currentUser = await User.findById(userId);
            console.log("Current user: ", currentUser, user);
            currentUser.isVerified = true;
            await currentUser.save();
            return currentUser;
        },

        removeMember: async (_, { groupId, memberId }, { user }) => {
            const group = await Group.findById(groupId);
            if (!group) return new UserInputError("No group exists with this code!");

            if (group.leader.toString() !== user._id.toString())
                return new UserInputError("You are not the leader of this group!");

            if (!group.members.includes(memberId)) return new UserInputError("User is no longer member of group!");

            group.members.pull(memberId);
            await group.save();

            let kickedUser = await User.findById(memberId);
            kickedUser.groups.pull(groupId);
            await kickedUser.save();

            return kickedUser;
        },
        createBeacon: async (_, { beacon, groupID }, { user, pubsub }) => {
            //the group to which this beacon will belong to.
            const group = await Group.findById(groupID);
            if (!group) return new UserInputError("No group exists with that id.");
            if (!group.members.includes(user.id) && group.leader != user.id)
                return new Error("User is not a part of the group!");

            const beaconDoc = new Beacon({
                leader: user.id,
                shortcode: nanoid(),
                location: beacon.startLocation,
                group: group.id,
                ...beacon,
            });

            const newBeacon = await beaconDoc.save().then(b => b.populate("leader followers"));
            user.beacons.push(newBeacon.id);
            group.beacons.push(newBeacon.id);
            await user.save();
            await group.save();

            pubsub.publish("GROUP_UPDATE", {
                groupUpdate: {
                    newUser: null,
                    newBeacon: newBeacon,
                    deletedBeacon: null,
                    updatedBeacon: null,
                    groupId: groupID,
                },
                groupID: groupID,
                groupMembers: group.members,
                groupLeader: group.leader,
            });

            return newBeacon;
        },

        createGroup: async (_, { group }, { user }) => {
            //since there is a very minute chance of shortcode colliding, we try to make the group 2 times if 1st one results in a collision.
            for (let i = 0; i < 2; i++) {
                try {
                    const groupDoc = new Group({
                        leader: user.id,
                        shortcode: nanoid(),
                        ...group,
                    });
                    const newGroup = await groupDoc.save().then(g => g.populate("leader"));
                    user.groups.push(newGroup.id);
                    await user.save();
                    return newGroup;
                } catch (e) {
                    return new Error(e);
                }
            }
            //if shortcode collides two times then return an error saying please try again.
            return new Error("Please try again!");
        },

        changeShortcode: async (_, { groupId }, { user }) => {
            let group = await Group.findById(groupId).populate("leader members");

            if (!group.leader._id.equals(user._id)) {
                throw new UserInputError("You are not the leader of the group!");
            }

            // trying two times in case gets shortcode collides
            for (let i = 0; i < 2; i++) {
                try {
                    const newShortcode = nanoid();
                    group.shortcode = newShortcode;
                    const updatedGroup = await Group.findByIdAndUpdate(
                        groupId,
                        { shortcode: newShortcode },
                        { new: true, timestamps: false }
                    ).populate("leader members");

                    return updatedGroup;
                } catch (e) {
                    // If there's a collision, retry
                    if (e instanceof MongoServerError && e.keyValue["shortcode"]) {
                        console.error(e);
                    } else {
                        // Else returning error
                        throw new Error(e);
                    }
                }
            }

            // If shortcode collides two times then returning to say try again
            return new Error("Please try again!");
        },

        rescheduleHike: async (_, { newStartsAt, newExpiresAt, beaconID }, { user, pubsub }) => {
            // populating group members to send members and leader ids in subscription filter
            const beacon = await Beacon.findById(beaconID).populate("group leader followers");

            if (!beacon) return new UserInputError("No beacon exists with that id.");
            if (!beacon.leader.toString() === user.id.toString())
                return new Error("Only the leader is allowed to change the beacon duration.");
            // if (beacon.startsAt.getTime() > newExpiresAt) return Error("Beacon can not expire before it has started.");
            beacon.startsAt = newStartsAt;
            beacon.expiresAt = newExpiresAt;
            await beacon.save();

            pubsub.publish("GROUP_UPDATE", {
                groupUpdate: {
                    newUser: null,
                    newBeacon: null,
                    deletedBeacon: null,
                    updatedBeacon: beacon,
                    groupId: beacon.group.id,
                },
                groupID: beacon.group.id,
                groupMembers: beacon.group.members,
                groupLeader: beacon.group.leader.toString(),
            });

            return beacon;
        },

        joinBeacon: async (_, { shortcode }, { user, pubsub }) => {
            const beacon = await Beacon.findOne({ shortcode });

            if (!beacon) return new UserInputError("No beacon exists with that shortcode.");
            if (beacon.expiresAt < Date.now()) return new Error("Beacon has expired");
            if (beacon.leader == user.id) return new Error("Already leading the beacon!");
            for (let i = 0; i < beacon.followers.length; i++)
                if (beacon.followers[i].id === user.id) {
                    return new Error("Already following the beacon!");
                }
            const group = await Group.findById(beacon.group);
            if (!group) return new UserInputError("No group exists with that id.");
            //if the user doesnt belong to the group, add him
            if (!group.members.includes(user.id) && group.leader != user.id) {
                group.members.push(user.id);
                user.groups.push(group.id);
                //publish over groupJoined Sub.
                pubsub.publish("GROUP_UPDATE", {
                    groupUpdate: {
                        newUser: user,
                        newBeacon: null,
                        deletedBeacon: null,
                        updatedBeacon: null,
                        groupId: group.id,
                    },
                    groupID: group.id,
                    groupMembers: group.members,
                    groupLeader: group.leader.id,
                });

                await group.save();
            }

            beacon.followers.push(user);
            await beacon.save().then(b => b.populate("leader"));

            pubsub.publish("JOIN_LEAVE", {
                JoinLeaveBeacon: {
                    newfollower: user,
                    inactiveuser: null,
                },
                beaconID: beacon.id,
            });

            user.beacons.push(beacon.id);
            await user.save();

            return beacon;
        },

        deleteBeacon: async (_parent, { id }, { user, pubsub }) => {
            const beacon = await Beacon.findById(id);
            if (!beacon) {
                return new UserInputError("No beacon exists with this id!");
            }

            if (beacon.leader.toString() !== user.id)
                return new Error("Beacon leader is allowed to delete the beacon!");

            await User.updateOne({ _id: user.id }, { $pull: { beacons: id } });

            const group = await Group.findById(beacon.group);
            group.beacons.pull(id);
            await group.save();

            const landmarkIds = beacon.landmarks;
            await Promise.all(landmarkIds.map(landmarkId => Landmark.findByIdAndDelete(landmarkId)));

            const deletedBeacon = await Beacon.findByIdAndDelete(id);

            pubsub.publish("GROUP_UPDATE", {
                groupUpdate: {
                    newUser: null,
                    newBeacon: null,
                    deletedBeacon: deletedBeacon,
                    updatedBeacon: null,
                    groupId: group.id,
                },
                groupID: group.id,
                groupMembers: group.members,
                groupLeader: group.leader.toString(),
            });

            return deletedBeacon !== null;
        },

        joinGroup: async (_, { shortcode }, { user, pubsub }) => {
            const group = await Group.findOne({ shortcode });

            if (!group) return new UserInputError("No group exists with that shortcode!");
            if (group.members.includes(user.id)) return new Error("Already a member of the group!");
            if (group.leader == user.id) return new Error("You are the leader of the group!");

            group.members.push(user.id);
            await group.save();
            await group.populate("leader members beacons");

            user.groups.push(group.id);
            await user.save();

            const groupId = group._id;

            // publish this change over GROUP_UPDATE subscription.
            pubsub.publish("GROUP_UPDATE", {
                groupUpdate: {
                    newUser: user,
                    newBeacon: null,
                    deletedBeacon: null,
                    updatedBeacon: null,
                    groupId: groupId,
                },
                groupID: groupId,
                groupMembers: group.members,
                groupLeader: group.leader.id,
            });

            return group;
        },

        createLandmark: async (_, { landmark, beaconID }, { user, pubsub }) => {
            const beacon = await Beacon.findById(beaconID);
            // to save on a db call to populate leader, we just use the stored id to compare

            if (!beacon) return new UserInputError("Beacon doesn't exist");

            if (!beacon.followers.includes(user.id) && beacon.leader != user.id)
                return new UserInputError("User should be part of beacon");
            const newLandmark = new Landmark({ createdBy: user.id, ...landmark });
            const populatedLandmark = await newLandmark.save().then(lan => lan.populate("createdBy"));

            beacon.landmarks.push(newLandmark.id);

            pubsub.publish("BEACON_LOCATIONS", {
                beaconLocations: {
                    userSOS: null,
                    route: null,
                    updatedUser: null,
                    landmark: populatedLandmark,
                },
                beaconID: beacon.id,
                followers: beacon.followers,
                leaderID: beacon.leader,
            });
            await beacon.save();

            return populatedLandmark;
        },

        updateUserLocation: async (_, { id, location }, { user, pubsub }) => {
            const beacon = await Beacon.findById(id);
            if (!beacon) return new UserInputError("No beacon exists with that id.");

            let updatedUser;

            if (user.id == beacon.leader) {
                // new route created by leader
                user.location = location;
                beacon.route.push(location);
                updatedUser = await user.save();
                await beacon.save();
                pubsub.publish("BEACON_LOCATIONS", {
                    beaconLocations: {
                        userSOS: null,
                        route: beacon.route,
                        updatedUser: null,
                        landmark: null,
                    },
                    beaconID: id,
                    followers: beacon.followers,
                    leaderID: beacon.leader,
                });
            } else {
                // new location of follower
                user.location = location;
                updatedUser = await user.save();
                pubsub.publish("BEACON_LOCATIONS", {
                    beaconLocations: {
                        userSOS: null,
                        route: null,
                        updatedUser: updatedUser,
                        landmark: null,
                    },
                    beaconID: id,
                    followers: beacon.followers,
                    leaderID: beacon.leader,
                });
            }

            return updatedUser;
        },

        sos: async (_, { id }, { user, pubsub }) => {
            const beacon = await Beacon.findById(id);

            if (!beacon) return new UserInputError("No beacon exist with this id!");

            if (beacon.leader != user.id && !beacon.followers.includes(user.id))
                return new UserInputError("You are not the part of beacon!");

            const currentDate = new Date();

            if (new Date(beacon.expiresAt) < currentDate) return new UserInputError("Beacon is already expired!");

            pubsub.publish("BEACON_LOCATIONS", {
                beaconLocations: {
                    userSOS: user,
                    route: null,
                    updatedUser: null,
                    landmark: null,
                },
                beaconID: id,
                followers: beacon.followers,
                leaderID: beacon.leader,
            });

            return user;
        },

        deleteUser: async (_, { credentials }) => {
            try {
                const userToDelete = await User.findOne({ email: credentials.email });
                console.log("User to delete:", userToDelete);
                if (!userToDelete) {
                    throw new UserInputError("User not found");
                }

                // Verify email matches
                if (userToDelete.email !== credentials.email) {
                    throw new AuthenticationError("Email does not match");
                }

                // Verify password
                const validPassword = await bcrypt.compare(credentials.password, userToDelete.password);
                if (!validPassword) {
                    throw new AuthenticationError("Invalid password");
                }

                // Handle groups
                const userGroups = await Group.find({
                    $or: [{ leader: userToDelete.id }, { members: userToDelete.id }],
                });

                for (const group of userGroups) {
                    if (group.leader.toString() === userToDelete.id) {
                        // If user is leader, delete the group and all its beacons
                        const groupBeacons = await Beacon.find({ group: group._id });
                        for (const beacon of groupBeacons) {
                            // Delete associated landmarks
                            await Landmark.deleteMany({ _id: { $in: beacon.landmarks } });
                            // Remove beacon reference from all followers
                            await User.updateMany(
                                { _id: { $in: beacon.followers } },
                                { $pull: { beacons: beacon._id } }
                            );
                        }
                        // Delete all beacons in the group
                        await Beacon.deleteMany({ group: group._id });
                        // Delete the group
                        await Group.findByIdAndDelete(group._id);
                    } else {
                        // If user is member, remove from group
                        await Group.findByIdAndUpdate(group._id, { $pull: { members: userToDelete.id } });
                    }
                }

                // Handle beacons where user is a follower
                await Beacon.updateMany({ followers: userToDelete.id }, { $pull: { followers: userToDelete.id } });

                // Delete landmarks created by user
                await Landmark.deleteMany({ createdBy: userToDelete.id });

                // Finally delete the user
                await User.findByIdAndDelete(userToDelete.id);

                return true;
            } catch (error) {
                console.error("Error deleting user:", error);
                if (error instanceof AuthenticationError || error instanceof UserInputError) {
                    throw error;
                }
                return false;
            }
        },
    },
    ...(process.env._HANDLER == null && {
        Subscription: {
            // for updating all the location changes in Beacon like leader members location,
            // landmarks creation,
            beaconLocations: {
                subscribe: withFilter(
                    (_, __, { pubsub }) => pubsub.asyncIterator(["BEACON_LOCATIONS"]),
                    (payload, variables, { user }) => {
                        const { beaconLocations, leaderID, followers, beaconID } = payload;
                        const { userSOS, route, updatedUser, landmark } = beaconLocations;

                        const isFollower = followers.includes(user.id);
                        const isLeader = leaderID == user.id;
                        const istrue = variables.id === beaconID && (isFollower || isLeader);

                        if (userSOS != null && user.id != userSOS._id) {
                            payload.beaconLocations.userSOS = parseUserObject(userSOS);
                            return istrue;
                        }
                        if (route != null && leaderID != user.id) {
                            return istrue;
                        }

                        // stopping user who has updated the location
                        if (updatedUser != null && updatedUser._id != user.id) {
                            payload.beaconLocations.updatedUser = parseUserObject(updatedUser);
                            return istrue;
                        }
                        // stopping the creator of landmark
                        if (landmark != null && landmark.createdBy._id != user.id) {
                            payload.beaconLocations.landmark = parseLandmarkObject(landmark);
                            return istrue;
                        }
                        return false;
                    }
                ),
            },

            JoinLeaveBeacon: {
                subscribe: withFilter(
                    (_, __, { pubsub }) => pubsub.asyncIterator(["JOIN_LEAVE"]),
                    (payload, variables, { user }) => {
                        let { beaconID, JoinLeaveBeacon } = payload;
                        let { newfollower, inactiveuser } = JoinLeaveBeacon;

                        if (newfollower != null) {
                            if (newfollower.id == user.id) {
                                return false;
                            }
                            return variables.id === beaconID;
                        }

                        if (inactiveuser != null) {
                            if (newfollower.id == user.id) {
                                payload.JoinLeaveBeacon.inactiveuser = parseUserObject(inactiveuser);
                                return false;
                            }
                            return variables.id === beaconID;
                        }
                    }
                ),
            },
            groupUpdate: {
                subscribe: withFilter(
                    (_, __, { pubsub }) => pubsub.asyncIterator(["GROUP_UPDATE"]),
                    (payload, variables, { user }) => {
                        const { groupID, groupMembers, groupLeader, groupUpdate } = payload;

                        let { newBeacon, groupId, deletedBeacon, updatedBeacon } = groupUpdate;
                        if (newBeacon != null) {
                            if (newBeacon.leader._id == user.id) {
                                // stopping to listen to the creator of beacon
                                return false;
                            }
                            payload.groupUpdate.newBeacon = parseBeaconObject(newBeacon);
                        } else if (deletedBeacon != null) {
                            if (deletedBeacon.leader.toString() === user._id.toString()) {
                                // stopping to listen to the creator of beacon
                                return false;
                            }
                            payload.groupUpdate.deletedBeacon = parseBeaconObject(deletedBeacon);
                        } else if (updatedBeacon != null) {
                            if (updatedBeacon.leader._id == user.id) {
                                // stopping to listen to the creator of beacon
                                return false;
                            }
                            payload.groupUpdate.updatedBeacon = parseBeaconObject(updatedBeacon);
                        }
                        if (!variables.groupIds.includes(groupID)) {
                            return false;
                        }
                        // checking if user is part of group or not
                        const isGroupLeader = groupLeader === user.id.toString();
                        const isGroupMember = groupMembers.includes(user.id);

                        let istrue = isGroupLeader || isGroupMember;
                        return istrue && variables.groupIds.includes(groupId);
                    }
                ),
            },
        },
    }),
};
module.exports = resolvers;
