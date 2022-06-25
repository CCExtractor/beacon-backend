const { AuthenticationError } = require("apollo-server-express");
const { rule } = require("graphql-shield");

const isAuthenticated = rule({ cache: "contextual" })(async (_parent, _args, ctx) => {
    if (ctx.user) return true;
    return new AuthenticationError("Authentication required to perform this action.");
});

module.exports = { isAuthenticated };
