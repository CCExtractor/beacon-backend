const { gql } = require("apollo-server-express");

const typeDefs = gql`
    type Location {
        lat: String!
        lon: String!
    }

    input LocationInput {
        lat: String!
        lon: String!
    }

    type Beacon {
        _id: ID!
        title: String
        shortcode: String!
        createdAt: Float!
        updatedAt: Float!
        expiresAt: Float!
        """
        N beacons case: multiple leaders
        """
        leader: [User!]!
        followers: [User!]!
        route: [Location!]!
    }

    input BeaconInput {
        title: String
        leaderID: String!
        startsAt: Float!
        expiresAt: Float!
    }

    type Landmark {
        _id: ID!
        createdAt: Float!
        title: String!
        location: Location!
        by: User!
    }

    input LandmarkInput {
        title: String!
        location: LocationInput!
        UserID: String!
    }

    type User {
        """
        there will be a password field in db but it will not be queryable
        """
        _id: ID!
        createdAt: Float!
        name: String!
        email: String!
        location: Location!
        beacons: [Beacon!]!
        landmarks: [Landmark!]!
    }

    input RegistrationInput {
        name: String!
        email: String!
        password: String!
    }

    type Query {
        beacon(me: String!): Beacon!
        pastBeacons(me: String!): [Beacon!]!
        me: User
        hello: String
    }

    type Mutation {
        createBeacon(beacon: BeaconInput): Beacon!
        createLandmark(landmark: LandmarkInput): Landmark!
        register(user: RegistrationInput): User!
        login(email: String!, password: String!): String
        joinBeacon(shortcode: String!, me: String!): Beacon!
    }

    schema {
        query: Query
        mutation: Mutation
    }
`;

module.exports = { typeDefs };
