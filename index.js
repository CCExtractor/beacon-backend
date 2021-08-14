// import http from "http";
import express from "express";
import expressJWT from "express-jwt";
// import jwt from "jsonwebtoken";
import { ApolloServer } from "apollo-server-lambda";
// import { applyMiddleware } from "graphql-middleware";
import { makeExecutableSchema } from "graphql-tools";
import mongoose from "mongoose";

import typeDefs from "./graphql/schema.js";
import resolvers from "./graphql/resolvers.js";
import { User } from "./models/user.js";
// import { permissions } from "./permissions/index.js";

// const pubsub = new PubSub();

const server = new ApolloServer({
    // schema: applyMiddleware(makeExecutableSchema({ typeDefs, resolvers }), permissions),
    schema: makeExecutableSchema({ typeDefs, resolvers }), // to temp disable shield on dev
    context: async ({ express }) => {
        // initialize context even if it comes from subscription connection
        // TODO: cleanup
        // if (connection) {
        //     return { user: connection.context.user };
        // }
        const { req } = express;
        const user = req?.user ? await User.findById(req.user.sub).populate("beacons") : null;
        return { user };
    },
    playground: {
        endpoint: "/dev/graphql",
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

const uri = process.env.DB;
const options = { useNewUrlParser: true, useUnifiedTopology: true };
mongoose.connect(uri, options);
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

exports.handler = server.createHandler({
    expressAppFromMiddleware(middleware) {
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
