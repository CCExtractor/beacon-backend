import { AuthenticationError, UserInputError } from "apollo-server-express";
import Beacon from "./models/beacon.js";

export const addUserToBeacon = async (user, shortcode) => {
    if (!user) throw new AuthenticationError("Authentication required to join beacon.");
    const beacon = await Beacon.find({ shortcode });
    if (!beacon) throw new UserInputError("No beacon exists with that shortcode.");
    if (beacon.followers.includes(user)) throw new Error("Already following the beacon");

    beacon.followers.push(user);
    await beacon.save();

    return beacon;
};
