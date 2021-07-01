import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { withFilter, AuthenticationError, UserInputError } from "apollo-server-express";
import { customAlphabet } from "nanoid";

import { User } from "./models/user.js";
import Beacon from "./models/beacon.js";
import { addUserToBeacon } from "./utils.js";

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
            if (credentials && (await User.find({ email: credentials.email })))
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
            const beaconDoc = new Beacon({ leader: user, shortcode: nanoid(), ...beacon });
            const newBeacon = await beaconDoc.save();
            return newBeacon;
        },

        joinBeacon: async (_, { shortcode }, { user }) => {
            return addUserToBeacon(user, shortcode);
        },

        updateLocation: async (_, { id, location }, { user, pubsub }) => {
            if (!user) throw new AuthenticationError("Authentication required to join beacon.");

            const beacon = await Beacon.findById(id);
            if (!beacon) throw new UserInputError("No beacon exists with that id.");

            if (beacon.leader.id != user.id) throw new Error("Only the beacon leader can update leader location");

            pubsub.publish("LEADER_LOCATION", { leaderLocation: location, beaconID: beacon.id });

            user.location.push(location);
            await user.save();

            return location;
        },
    },

    Subscription: {
        testNumberIncremented: {
            subscribe: (_parent, _args, { pubsub }) => pubsub.asyncIterator(["NUMBER_INCREMENTED"]),
        },
        leaderLocation: {
            subscribe: withFilter(
                (_, __, { pubsub }) => pubsub.asyncIterator(["LEADER_LOCATION"]),
                (payload, variables) => payload.beaconID === variables.id
            ),
        },
    },
};

export default resolvers;
