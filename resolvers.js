import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { withFilter, AuthenticationError, UserInputError } from "apollo-server-express";
import { customAlphabet } from "nanoid";

import { User } from "./models/user.js";
import Beacon from "./models/beacon.js";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
// even if we generate 10 IDs per hour,
// ~10 days needed, in order to have a 1% probability of at least one collision.
const nanoid = customAlphabet(alphabet, 6);

const resolvers = {
    Query: {
        hello: () => "Hello world!",
        me: (_parent, _args, { user }) => user,
        currentNumber: (_parent, _args, { currentNumber }) => currentNumber,
    },

    Mutation: {
        register: async (_parent, { user }) => {
            const { name, credentials } = user;

            // check if user already exists
            if (credentials && (await User.findOne({ email: credentials.email })) !== null)
                throw new UserInputError("User with email already registered.");

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
            if (!id && !credentials) throw new UserInputError("One of ID and credentials required");

            const { email, password } = credentials || {}; // unpack if available
            const user = id ? await User.findById(id) : await User.findOne({ email });

            if (!user) throw new Error("User not found.");

            // prevent third party using id to login when user registered
            if (user.email && !credentials) throw new UserInputError("Email/password required to login");

            console.log("User logged in: ", user, new Date());

            let anon = true;

            if (credentials) {
                const valid = email === user.email && (await bcrypt.compare(password, user.password));
                if (!valid) throw new AuthenticationError("credentials don't match");
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
            if (!user) throw new AuthenticationError("Authentication required to create beacon.");
            console.log(beacon);

            const beaconDoc = new Beacon({ leader: user.id, shortcode: nanoid(), ...beacon });
            const newBeacon = await beaconDoc.save().then(b => b.populate("leader").execPopulate());

            user.beacons.push(newBeacon.id);
            await user.save();

            return newBeacon;
        },

        joinBeacon: async (_, { shortcode }, { user, pubsub }) => {
            if (!user) throw new AuthenticationError("Authentication required to join beacon.");

            const beacon = await Beacon.findOne({ shortcode });

            if (!beacon) throw new UserInputError("No beacon exists with that shortcode.");
            if (beacon.followers.includes(user)) throw new Error("Already following the beacon");

            beacon.followers.push(user);
            await beacon.save().then(b => b.populate("leader").execPopulate());
            pubsub.publish("BEACON_JOINED", { beaconFollower: user, leaderID: beacon.leader.id });

            user.beacons.push(beacon.id);
            await user.save();

            return beacon;
        },

        updateLocation: async (_, { id, location }, { user, pubsub }) => {
            if (!user) throw new AuthenticationError("Authentication required to join beacon.");

            const beacon = await Beacon.findById(id);
            if (!beacon) throw new UserInputError("No beacon exists with that id.");

            if (beacon.leader != user.id) throw new Error("Only the beacon leader can update leader location");

            // beacon id used for filtering but only location sent to user bc schema
            pubsub.publish("BEACON_LOCATION", { beaconLocation: location, beaconID: beacon.id });

            user.location.push(location);
            await user.save();

            return location;
        },
    },

    Subscription: {
        testNumberIncremented: {
            subscribe: (_parent, _args, { pubsub }) => pubsub.asyncIterator(["NUMBER_INCREMENTED"]),
        },
        beaconLocation: {
            subscribe: withFilter(
                (_, __, { pubsub }) => pubsub.asyncIterator(["BEACON_LOCATION"]),
                (payload, variables) => payload.beaconID === variables.id
            ),
        },
        beaconJoined: {
            subscribe: withFilter(
                (_, __, { pubsub }) => pubsub.asyncIterator(["BEACON_JOINED"]),
                (payload, variables) => payload.leaderID === variables.id
            ),
        },
    },
};

export default resolvers;
