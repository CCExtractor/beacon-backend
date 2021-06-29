import http from "http";
import express from "express";
import expressJWT from "express-jwt";
import { ApolloServer, PubSub } from "apollo-server-express";
import mongoose from "mongoose";

import typeDefs from "./schema.js";
import resolvers from "./resolvers.js";
import { User } from "./models/user.js";
import Beacon from "./models/beacon.js";
import { addUserToBeacon } from "./utils.js";

const pubsub = new PubSub();

let currentNumber = 0;
// function incrementNumber() {
//     currentNumber++;
//     pubsub.publish("NUMBER_INCREMENTED", { numberIncremented: currentNumber });
//     setTimeout(incrementNumber, 1000);
// }

const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: async ({ req }) => {
        const user = req && req.user ? await User.findById(req.user.sub) : null;
        return { user, pubsub, currentNumber };
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

app.get("/j/:shortcode", async (req, res) => {
    const { user } = req;
    const { shortcode } = req.params;
    const beacon = Beacon.findOne({ shortcode });

    res.send(await addUserToBeacon(user, beacon));
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
