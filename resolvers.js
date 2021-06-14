import User from "./models/user.js";
import bcrypt from "bcryptjs";

const resolvers = {
    Query: {
        hello: () => "Hello world!",
    },

    Mutation: {
        register: async (_parent, { user }) => {
            const { name, email, password } = user;
            const newUser = new User({
                name,
                ...(email && password && { 
                    email, 
                    password: await bcrypt.hash(password, 10) 
                }),
            });
            const userObj = await newUser.save();
            return userObj;
        },
    },
};

export default resolvers;
