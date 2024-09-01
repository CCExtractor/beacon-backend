const http = require("http");
const express = require("express");
const expressJWT = require("express-jwt");
const jwt = require("jsonwebtoken");
const { ApolloServer } = require("apollo-server-express");
const { applyMiddleware } = require("graphql-middleware");
const { makeExecutableSchema } = require("graphql-tools");
const mongoose = require("mongoose");
const typeDefs = require("./graphql/schema.js");
const resolvers = require("./graphql/resolvers.js");
const { User } = require("./models/user.js");
const { permissions } = require("./permissions/index.js");
const pubsub = require("./pubsub.js");

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
            { port: port },
            console.log(
                `Server ready at http://localhost:${port}${server.graphqlPath}\n` +
                    `Subscriptions endpoint at ws://localhost:${port}${server.subscriptionsPath}`
            )
        )
    )
    .catch(error => {
        throw error;
    });
