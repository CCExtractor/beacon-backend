// const http =  require("http");
const express = require("express");
const expressJWT = require("express-jwt");
// const jwt =  require("jsonwebtoken");
const { ApolloServer } = require("apollo-server-lambda");
const { applyMiddleware } = require("graphql-middleware");
const { makeExecutableSchema } = require("graphql-tools");
const mongoose = require("mongoose");
const typeDefs = require("../graphql/schema.js");
const resolvers = require("../graphql/resolvers.js");
const { User } = require("../models/user.js");
const { permissions } = require("../permissions/index.js");
const pubsub = require("../pubsub.js");
require("dotenv").config();

let conn = null;
// const pubsub = new PubSub();
const uri = process.env.DB;
const options = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    bufferCommands: false,
};

// console.log("connecting to db");
// (async () => await mongoose.connect(uri, options))();
// console.log("just connected to db");
// .then(() =>
//     app.listen(
//         { port: 4000 },
//         console.log(
//             `Server ready at http://localhost:4000${server.graphqlPath}\n` +
//                 `Subscriptions endpoint at ws://localhost:4000${server.subscriptionsPath}`
//         )
//     )
// )
// .catch(error => {
//     throw error;
// });

const server = new ApolloServer({
    schema: applyMiddleware(makeExecutableSchema({ typeDefs, resolvers }), permissions),
    // schema: makeExecutableSchema({ typeDefs, resolvers }), // to temp disable shield on dev
    context: async ({ /*event*/ context, express }) => {
        // initialize context even if it comes from subscription connection
        // TODO: cleanup
        // if (connection) {
        //     return { user: connection.context.user };
        // }
        // console.log(event);
        context.callbackWaitsForEmptyEventLoop = false;
        const { req } = express;
        const user = req?.user ? await User.findById(req.user.sub).populate("beacons") : null;
        return { user, pubsub };
    },
    // subscriptions: {
    //     path: "/subscriptions",
    //     onConnect: async connectionParams => {
    //         console.log("Client connected");
    //         const authorization = connectionParams["Authorization"];
    //         // add user to connection context
    //         if (authorization) {
    //             try {
    //                 const decoded = jwt.verify(authorization.replace("Bearer ", ""), process.env.JWT_SECRET);
    //                 console.log("decoded: ", decoded);
    //                 const user = await User.findById(decoded.sub).populate("beacons");
    //                 return { user };
    //             } catch (err) {
    //                 throw new Error("Invalid token!");
    //             }
    //         }
    //         throw new Error("Missing auth token!");
    //     },
    //     onDisconnect: () => {
    //         console.log("Client disconnected");
    //     },
    // },
});

// server.applyMiddleware({ app });
// const httpServer = http.createServer(app);
// server.installSubscriptionHandlers(httpServer);

const graphqlHandler = server.createHandler({
    expressAppFromMiddleware(middleware) {
        const app = express();
        app.use(
            expressJWT({
                secret: process.env.JWT_SECRET,
                algorithms: ["HS256"],
                credentialsRequired: false,
            })
        );

        // app.get("/", (req, res) => res.send("Hello World! This is a GraphQL API. Check out /graphql"));

        app.get("/j/:shortcode", async (_req, res) => {
            console.log(`shortcode route hit`);
            res.send("this should open in the app eventually");
        });

        app.use(middleware);
        return app;
    },
    expressGetMiddlewareOptions: {
        cors: {
            origin: "*",
            credentials: true,
        },
    },
});

exports.handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    if (!conn) {
        console.log("connecting to db");
        conn = await mongoose.connect(uri, options).then(() => mongoose);
        console.log("just connected to db");
    }

    return graphqlHandler(event, context);
};
