import express from "express";
import { ApolloServer } from "apollo-server-express";
import mongoose from "mongoose";

import typeDefs from "./schema.js";
import resolvers from "./resolvers.js";

async function startServer() {
    const server = new ApolloServer({ typeDefs, resolvers });
    await server.start();

    const app = express();
    server.applyMiddleware({ app });

    await new Promise(resolve => app.listen({ port: 4000 }, resolve));
    console.log(`Server ready at http://localhost:4000${server.graphqlPath}`);
    return { server, app };
}

const uri = process.env.DB;
const options = { useNewUrlParser: true, useUnifiedTopology: true };
mongoose
    .connect(uri, options)
    .then(() => startServer())
    .catch(error => {
        throw error;
    });
