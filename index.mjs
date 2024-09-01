import http from "http";
import express from "express";
import expressJWT from "express-jwt";
import jwt from "jsonwebtoken";
import { ApolloServer } from "apollo-server-express";
import { applyMiddleware } from "graphql-middleware";
import { makeExecutableSchema } from "graphql-tools";
import mongoose from "mongoose";
import typeDefs from "./graphql/schema.js";
import resolvers from "./graphql/resolvers.js";
import { User } from "./models/user.js";
import { permissions } from "./permissions/index.js";
import pubsub from "./pubsub.js";

const server = new ApolloServer({
    schema: applyMiddleware(makeExecutableSchema({ typeDefs, resolvers }), permissions),
    context: async ({ req, connection }) => {
        if (connection) {
            return { user: connection.context.user, pubsub };
        }
        const user = req?.user ? await User.findById(req.user.sub).populate("beacons") : null;
        return { user, pubsub };
    },
    stopGracePeriodMillis: Infinity,
    stopOnTerminationSignals: false,
    subscriptions: {
        path: "/graphql",
        keepAlive: 9000,
        onConnect: async connectionParams => {
            console.log("Client connected");
            const authorization = connectionParams["Authorization"];

            if (authorization) {
                try {
                    const decoded = jwt.verify(authorization.replace("Bearer ", ""), process.env.JWT_SECRET);
                    console.log("decoded: ", decoded);
                    const user = await User.findById(decoded.sub).populate("beacons");
                    return { user };
                } catch (err) {
                    console.log(err);
                    throw new Error("Invalid token!");
                }
            }
            throw new Error("Missing auth token!");
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


const port = 4000 || process.env.PORT;

mongoose
    .connect(process.env.DB)
    .then(() =>
        httpServer.listen(
            { port: port},
            console.log(
                `Server ready at http://localhost:${port}${server.graphqlPath}\n` +
                    `Subscriptions endpoint at ws://localhost:${port}${server.subscriptionsPath}`
            )
        )
    )
    .catch(error => {
        throw error;
    });
