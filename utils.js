import { AuthenticationError, UserInputError } from "apollo-server-express";

export const addUserToBeacon = async (user, beacon) => {
    if (!user) throw new AuthenticationError("Authentication required to join beacon.");
    if (!beacon) throw new UserInputError("No beacon exists with that id/shortcode.");
    if (beacon.followers.includes(user)) throw new Error("Already following the beacon");

    beacon.followers.push(user);
    await beacon.save();

    return beacon;
};
