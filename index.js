const express = require("express");
const { ApolloServer } = require("apollo-server-express");
const { typeDefs } = require("./schema");

async function startApolloServer() {
    // Provide resolver functions for your schema fields
    const resolvers = {
        Query: {
            hello: () => "Hello world!",
        },
    };

    const server = new ApolloServer({ typeDefs, resolvers });
    await server.start();

    const app = express();
    server.applyMiddleware({ app });

    await new Promise(resolve => app.listen({ port: 4000 }, resolve));
    console.log(`🚀 Server ready at http://localhost:4000${server.graphqlPath}`);
    return { server, app };
}

(async () => startApolloServer())();
