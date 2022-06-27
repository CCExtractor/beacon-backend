const { allow, not, shield } = require("graphql-shield");
const { isAuthenticated } = require("./rules.js");

const permissions = shield({
    Query: {
        "*": isAuthenticated,
        hello: allow,
    },
    Mutation: {
        "*": isAuthenticated,
        register: not(isAuthenticated),
        login: not(isAuthenticated),
    },
});

module.exports = { permissions };
