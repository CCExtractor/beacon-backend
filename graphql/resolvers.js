const { AuthenticationError, UserInputError, withFilter } = require("apollo-server-express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { customAlphabet } = require("nanoid");
const geolib = require("geolib");
const { isPointWithinRadius } = geolib;
const Beacon = require("../models/beacon.js");
const Landmark = require("../models/landmark.js");
const { User } = require("../models/user.js");

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
// even if we generate 10 IDs per hour,
// ~10 days needed, in order to have a 1% probability of at least one collision.
const nanoid = customAlphabet(alphabet, 6);

const resolvers = {
    Query: {
        hello: () => "Hello world!",
        me: async (_parent, _args, { user }) => {
            await user.populate("beacons.leader beacons.landmarks");
            return user;
        },
        beacon: async (_parent, { id }, { user }) => {
            const beacon = await Beacon.findById(id).populate("landmarks leader");
            if (!beacon) return new UserInputError("No beacon exists with that id.");
            // return beacon iff user in beacon
            if (beacon.leader.id === user.id || beacon.followers.includes(user))
                return new Error("User should be a part of beacon");
            return beacon;
        },
        nearbyBeacons: async (_, { location }) => {
            // get active beacons
            const beacons = await Beacon.find({ expiresAt: { $gte: new Date() } }).populate("leader");
            let nearby = [];
            beacons.forEach(b => {
                // unpack to not pass extra db fields to function
                const { lat, lon } = b.location;
                if (isPointWithinRadius({ lat, lon }, location, 1500)) nearby.push(b); // add beacons within 1.5km
            });
            console.log("nearby beacons:", nearby);
            return nearby;
        },
    },

    Mutation: {
        register: async (_parent, { user }) => {
            const { name, credentials } = user;

            // check if user already exists
            if (credentials && (await User.findOne({ email: credentials.email })) !== null)
                return new UserInputError("User with email already registered.");

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

        login: async (_parent, { id, credentials }) => {
            if (!id && !credentials) return new UserInputError("One of ID and credentials required");

            const { email, password } = credentials || {}; // unpack if available
            const user = id ? await User.findById(id) : await User.findOne({ email });

            if (!user) return new Error("User not found.");

            // prevent third party using id to login when user registered
            if (user.email && !credentials) return new UserInputError("Email/password required to login");

            console.log("User logged in: ", user, new Date());

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

        createBeacon: async (_, { beacon }, { user }) => {
            console.log(beacon);
            if (beacon.startsAt > beacon.expiresAt) return Error("Beacon can not expire before it has started.");
            const beaconDoc = new Beacon({
                leader: user.id,
                shortcode: nanoid(),
                location: beacon.startLocation,
                ...beacon,
            });
            const newBeacon = await beaconDoc.save().then(b => b.populate("leader"));
            user.beacons.push(newBeacon.id);
            await user.save();

            return newBeacon;
        },

        changeBeaconDuration: async (_, { newStartsAt, newExpiresAt, beaconID }, { user }) => {
            const beacon = await Beacon.findById(beaconID);

            if (!beacon) return new UserInputError("No beacon exists with that id.");
            if (beacon.leader != user.id)
                return new Error("Only the leader is allowed to change the beacon duration.");
            if (newStartsAt > newExpiresAt) return Error("Beacon can not expire before it has started.")
            beacon.startsAt = newStartsAt;
            beacon.expiresAt = newExpiresAt;
            await beacon.save();

            return beacon;
        },

        joinBeacon: async (_, { shortcode }, { user, pubsub }) => {
            const beacon = await Beacon.findOne({ shortcode });

            if (!beacon) return new UserInputError("No beacon exists with that shortcode.");
            if (beacon.expiresAt < Date.now()) return new Error("Beacon has expired");
            if (beacon.followers.includes(user)) return new Error("Already following the beacon");

            beacon.followers.push(user);
            console.log("user joined beacon: ", user);
            await beacon.save().then(b => b.populate("leader"));

            pubsub.publish("BEACON_JOINED", { beaconJoined: user, beaconID: beacon.id });

            user.beacons.push(beacon.id);
            await user.save();

            return beacon;
        },

        createLandmark: async (_, { landmark, beaconID }, { user }) => {
            const beacon = await Beacon.findById(beaconID);
            // to save on a db call to populate leader, we just use the stored id to compare
            if (!beacon || (!beacon.followers.includes(user.id) && beacon.leader.toString() !== user.id))
                return new UserInputError("User should be part of beacon.");
            const newLandmark = new Landmark({ createdBy: user.id, ...landmark });
            await newLandmark.save();

            beacon.landmarks.push(newLandmark.id);
            await beacon.save();

            return newLandmark;
        },

        updateBeaconLocation: async (_, { id, location }, { user, pubsub }) => {
            const beacon = await Beacon.findById(id).populate("leader");
            if (!beacon) return new UserInputError("No beacon exists with that id.");

            if (beacon.leader.id !== user.id) return new Error("Only the beacon leader can update beacon location");

            // beacon id used for filtering but only location sent to user bc schema
            pubsub.publish("BEACON_LOCATION", { beaconLocation: location, beaconID: beacon.id });

            beacon.location = location;
            await beacon.save();

            return beacon;
        },

        updateUserLocation: async (_, { id, location }, { user, pubsub }) => {
            const beacon = await Beacon.findById(id);
            if (!beacon) return new UserInputError("No beacon exists with that id.");

            user.location = location;
            await user.save();

            // beacon id used for filtering but only location sent to user bc schema
            pubsub.publish("USER_LOCATION", { userLocation: user, beaconID: beacon.id }); // TODO: harden it so non-essential user data is not exposed

            return user;
        },

        changeLeader: async (_, { beaconID, newLeaderID }, { user }) => {
            const beacon = await Beacon.findById(beaconID);
            if (!beacon) return new UserInputError("No beacon exists with that id.");

            if (beacon.leader != user.id) return new Error("Only the beacon leader can update leader");

            beacon.leader = newLeaderID;
            await beacon.save();

            return beacon;
        },
    },
    ...(process.env._HANDLER == null && {
        Subscription: {
            beaconLocation: {
                subscribe: withFilter(
                    (_, __, { pubsub }) => pubsub.asyncIterator(["BEACON_LOCATION"]),
                    (payload, variables) => payload.beaconID === variables.id
                ),
            },
            userLocation: {
                subscribe: withFilter(
                    (_, __, { pubsub }) => pubsub.asyncIterator(["BEACON_LOCATION"]),
                    (payload, variables, { user }) => {
                        return payload.beaconID === variables.id && payload.userLocation.id !== user.id; // account for self updates
                    }
                ),
            },
            beaconJoined: {
                subscribe: withFilter(
                    (_, __, { pubsub }) => pubsub.asyncIterator(["BEACON_JOINED"]),
                    (payload, variables) => payload.beaconID === variables.id
                ),
            },
        },
    }),
};
module.exports = resolvers;
