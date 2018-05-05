"use strict";

const http = require('http');
const macfromip = require('macfromip');

async function get_mac(ip) {
    return new Promise(function(resolve, reject) {
        macfromip.getMac(ip, function(err, data) {
            if (err) {
                console.log(err);
                reject(err);
            } else
                resolve(data);
        });
    });
};

http.createServer((async (req, res) => {
    console.log('Request from: ' + req.connection.remoteAddress);

    // TODO avoid localhost no MAC issue and route to setup page first

    try {
        var mac = await get_mac(req.connection.remoteAddress);
    } catch (e) {
        console.log(e.name + ': ' + e.message);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain');
        res.end(e.name + ': ' + e.message + '\n');
        return;
    }

    res.writeHead(200, {'Content-Type': 'text/text'});
    res.write('Hello ' + mac + '!\n');
    res.end();
})).listen(8080, '0.0.0.0'); // '0.0.0.0' forces IPv4 IP address (macfromip only supports IPv4)

console.log("Server listening on port 8080\n");
