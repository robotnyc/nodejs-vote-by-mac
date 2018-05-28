# nodejs-vote-by-mac
Node.js voting system using the MAC address to identify voters.

This web app is meant to be run on a local network from a Linux machine. The MAC address of the client/voter is only available in this configuration because it uses the local ARP cache to resolve the MAC address from the IP.

# Usage

 * Votes are cast by visiting the URL `/NUMBER`, where NUMBER is a number from 1 to 100.
 * A vote for 0 is used to delete the vote.
 * Votes are stored in RAM and lost when the server is restarted.

