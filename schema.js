import { gql } from "apollo-server-express";

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
        startsAt: Float!
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
        leader: ID!
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
        by: ID!
    }

    type User {
        """
        there will be a password field in db but it will not be queryable
        """
        _id: ID!
        createdAt: Float!
        """
        name, email, location optional for anon access
        """
        name: String
        email: String
        location: Location
        beacons: [Beacon!]!
        landmarks: [Landmark!]!
    }

    input AuthPayload {
        email: String!
        password: String!
    }

    input RegistrationInput {
        name: String!
        credentials: AuthPayload
    }

    type Query {
        beacon(me: ID!): Beacon!
        pastBeacons(me: ID!): [Beacon!]!
        me: User
        hello: String
        currentNumber: Int
    }

    type Mutation {
        """
        if start time not supplied, default is Date.now
        """
        createBeacon(beacon: BeaconInput): Beacon!
        createLandmark(landmark: LandmarkInput): Landmark!
        register(user: RegistrationInput): User!
        """
        one of ID or credentials required (ID for anon)
        """
        login(id: ID, credentials: AuthPayload): String
        joinBeacon(id: ID!): Beacon!
        updateLocation(id: ID!, location: LocationInput!): Location!
    }

    type Subscription {
        leaderLocation: Location
        testNumberIncremented: Int
    }

    schema {
        query: Query
        mutation: Mutation
        subscription: Subscription
    }
`;

export default typeDefs;
