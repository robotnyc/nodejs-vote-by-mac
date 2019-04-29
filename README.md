# nodejs-vote-by-mac
Node.js voting system using the MAC address to identify voters.

This web app is meant to be run on a local network from a Linux machine, such as a Raspberry Pi. The MAC address of the client/voter is only available in this configuration because it uses the local ARP cache to resolve the MAC address from the IP.

# Usage

 * Votes are cast by visiting the URL `/NUMBER`.
 * A vote for 0 is used to delete the vote.
 * Votes are stored in RAM and lost when the server is restarted.
 * Configuration options are available in the file `config.js`.
 * Configuration options can be modified by visiting the URL `/config`.

# API

The following JSON endpoints are available for integrations.

 * `/votes` an unmasked dictionary of all the votes.
 * `/results` a dictionary of the results of the votes.
 * `/winners` a list of winners (more than one if there's a tie).
 * `/random` make a random vote from a random MAC for testing.
 * `/count` the current vote count.
