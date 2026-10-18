import type { ApiClient } from "../ports";

/** Thrown for any API call made without an Account; the Collection then works on the device alone. */
export class NotSignedIn extends Error {
  constructor() {
    super("Not signed in");
    this.name = "NotSignedIn";
  }
}

/**
 * The API as a signed-out Holder sees it: everything needs an Account, so
 * nothing is sent. Scans are parsed on the device (spec story 13).
 */
export const signedOutApiClient: ApiClient = {
  parseCardText: async () => {
    throw new NotSignedIn();
  },
};
