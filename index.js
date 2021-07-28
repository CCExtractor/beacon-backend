import http from "http";
import express from "express";
import expressJWT from "express-jwt";
import { ApolloServer, PubSub } from "apollo-server-express";
import { applyMiddleware } from "graphql-middleware";
import { makeExecutableSchema } from "graphql-tools";
import mongoose from "mongoose";

import typeDefs from "./graphql/schema.js";
import resolvers from "./graphql/resolvers.js";
import { User } from "./models/user.js";
import { permissions } from "./permissions/index.js";

const pubsub = new PubSub();

const server = new ApolloServer({
    schema: applyMiddleware(makeExecutableSchema({ typeDefs, resolvers }), permissions),
    context: async ({ req }) => {
        const user = req && req.user ? await User.findById(req.user.sub).populate("beacons") : null;
        return { user, pubsub };
    },
    subscriptions: {
        path: "/subscriptions",
        onConnect: () => {
            console.log("Client connected");
        },
        onDisconnect: () => {
            console.log("Client disconnected");
        },
    },
});

const app = express();

app.use(
    expressJWT({
        secret: process.env.JWT_SECRET,
        algorithms: ["HS256"],
        credentialsRequired: false,
    })
);

app.get("/", (req, res) => res.send("Hello World! This is a GraphQL API. Check out /graphql"));

app.get("/j/:shortcode", async (_req, res) => {
    console.log(`shortcode route hit`);
    res.send("this should open in the app eventually");
});

server.applyMiddleware({ app });
const httpServer = http.createServer(app);
server.installSubscriptionHandlers(httpServer);

const uri = process.env.DB;
const options = { useNewUrlParser: true, useUnifiedTopology: true };
mongoose
    .connect(uri, options)
    .then(() =>
        httpServer.listen(
            { port: 4000 },
            console.log(
                `Server ready at http://localhost:4000${server.graphqlPath}\n` +
                    `Subscriptions endpoint at ws://localhost:4000${server.subscriptionsPath}`
            )
        )
    )
    .catch(error => {
        throw error;
    });
