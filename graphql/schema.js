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
        startsAt: Float!
        expiresAt: Float!
        """
        most recent location
        """
        location: Location!
        """
        N beacons case: multiple leaders
        leader: [ID!]!
        """
        leader: User!
        followers: [User!]!
        route: [Location!]!
        landmarks: [Landmark!]!
        group: Group!
    }

    input BeaconInput {
        title: String
        """
        default is Date.now
        """
        startsAt: Float
        expiresAt: Float!
        startLocation: LocationInput!
    }

    type Landmark {
        _id: ID!
        createdAt: Float!
        title: String!
        location: Location!
        createdBy: User!
    }

    input LandmarkInput {
        title: String!
        location: LocationInput!
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
        groups: [Group!]!
    }

    input AuthPayload {
        email: String!
        password: String!
    }

    input RegistrationInput {
        name: String!
        credentials: AuthPayload
    }

    type Group {
        _id: ID!
        title: String
        shortcode: String!
        leader: User!
        members: [User!]!
        beacons: [Beacon!]!
    }

    input GroupInput {
        title: String!
    }

    type Query {
        beacon(id: ID!): Beacon!
        group(id: ID!): Group!
        nearbyBeacons(location: LocationInput!): [Beacon!]!
        me: User
        hello: String
    }

    type Mutation {
        """
        if start time not supplied, default is Date.now
        """
        createBeacon(beacon: BeaconInput, groupID: String!): Beacon!
        createLandmark(landmark: LandmarkInput, beaconID: ID!): Landmark!
        register(user: RegistrationInput): User!
        """
        one of ID or credentials required (ID for anon)
        """
        login(id: ID, credentials: AuthPayload): String
        joinBeacon(shortcode: String!): Beacon!
        updateBeaconLocation(id: ID!, location: LocationInput!): Beacon!
        updateUserLocation(id: ID!, location: LocationInput!): User!
        changeLeader(beaconID: ID!, newLeaderID: ID!): Beacon!
        changeBeaconDuration(newExpiresAt: Float!, beaconID: ID!): Beacon!
        createGroup(group: GroupInput): Group!
        joinGroup(shortcode: String!): Group!
    }

    type Subscription {
        beaconLocation(id: ID!): Location
        userLocation(id: ID!): User
        beaconJoined(id: ID!): User
        groupJoined(groupID: ID!): User
    }

    schema {
        query: Query
        mutation: Mutation
        subscription: Subscription
    }
`;

module.exports = typeDefs;
