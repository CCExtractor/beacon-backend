import express from "express";
import expressJWT from "express-jwt";
import { ApolloServer } from "apollo-server-express";
import mongoose from "mongoose";

import typeDefs from "./schema.js";
import resolvers from "./resolvers.js";
import User from "./models/user.js";

const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: async ({ req }) => {
        const user = req.user ? await User.findById(req.user.sub) : null;
        return { user };
    },
});

const app = express();

app.get("/", (req, res) => res.send("Hello World! This is a GraphQL API. Check out /graphql"));

app.use(
    expressJWT({
        secret: process.env.JWT_SECRET,
        algorithms: ["HS256"],
        credentialsRequired: false,
    })
);

server.applyMiddleware({ app });

const uri = process.env.DB;
const options = { useNewUrlParser: true, useUnifiedTopology: true };
mongoose
    .connect(uri, options)
    .then(() => app.listen({ port: 4000 }, console.log(`Server ready at http://localhost:4000${server.graphqlPath}`)))
    .catch(error => {
        throw error;
    });
