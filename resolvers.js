import User from "./models/user.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AuthenticationError, UserInputError } from "apollo-server-express";

const resolvers = {
    Query: {
        hello: () => "Hello world!",
    },

    Mutation: {
        register: async (_parent, { user }) => {
            const { name, credentials } = user;
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
    },
};

export default resolvers;
