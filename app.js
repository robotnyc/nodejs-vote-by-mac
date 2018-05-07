"use strict";

const http = require('http');
const { exec } = require('child_process');

function execPromise(command) {
    return new Promise(function(resolve, reject) {
        exec(command, (error, stdout, stderr) => {
            if (error)
                reject(error);
            else
                resolve(stdout.trim());
        });
    });
};

// votes are stored in RAM
var votes = {};

function render_results(req, res) {
    let results = {};
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write('<!DOCTYPE html>\n<html>\n');
    res.write('<head>\n<meta name="viewport" content="width=device-width, initial-scale=1">\n');
    res.write('<style>\nh1, table {\n\tfont-size: 10vw;\n\tborder-collapse: collapse;\n}\ntable, th, td {\n\tborder: 1px solid #ddd;\n}\n</style></head>\n');
    res.write('<p>Go to /NUMBER to cast or update your vote.</p>\n');
    res.write('<p>Go to /0 to delete your vote.</p>\n');
    res.write('<p>Go to / for the results.</p>\n');
    res.write('<body>\n<h1>Votes</h1>\n');
    res.write('<table>\n\t<tr>\n\t\t<th>MAC</th>\n\t\t<th>Vote</th>\n</tr>\n');
    for (var voter in votes) {
        let vote = votes[voter];
        if (vote in results)
            results[vote] += 1;
        else
            results[vote] = 1;
        res.write('\t<tr>\n\t\t<td>' + voter + '</td>\n\t\t<td>' + votes[voter] + '</td>\n\t<tr>\n');
    }
    res.write('<table>\n');
    res.write('<h1>Results</h1>\n');
    res.write('<table>\n\t<tr>\n\t\t<th>Choice</th>\n\t\t<th>Count</th>\n</tr>\n');
    for (var choice in results) {
        res.write('\t<tr>\n\t\t<td>' + choice + '</td>\n\t\t<td>' + results[choice] + '</td>\n\t<tr>\n');
    }
    res.write('</table>\n</body>\n</html>');
    res.end();
    return;
};

http.createServer((async (req, res) => {
    console.log('Request from: ' + req.connection.remoteAddress);
    var mac = await execPromise(`arp -n | awk '/${req.connection.remoteAddress}/{print $3;exit}'`);

    // MAC not found / invalid (e.g. localhost)
    if (!/^([0-9a-f]{2}[:-]){5}([0-9a-f]{2})$/.test(mac)) {
        render_results(req, res);
        return;
    }

    // process vote from URL server/#
    let url = req.url.replace(/^\/+/g, '');
    switch (true) {
        case ((parseInt(url) > 0) && (parseInt(url) < 100)):
            console.log('Vote: ' + url);
            votes[mac] = url;
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.write('<!DOCTYPE html>\n<html>\n');
            res.write('<head>\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<metahttp-equiv="refresh" content="5;url=/" />\n');
            res.write('<style>\np {\n\tfont-size: 10vw;\n}\n\n</style></head>\n');
            res.write('<body>\n');
            res.write('<p>Hello ' + mac + '!</p>\n');
            res.write('<p>Your vote for ' + url + ' has been recorded.</p>\n');
            res.write('</body>\n</html>\n');
            res.end();
            break;
        case (parseInt(url) == 0):
            console.log('Vote: ' + url);
            delete votes[mac];
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.write('<!DOCTYPE html>\n<html>\n');
            res.write('<head>\n<meta name="viewport" content="width=device-width, initial-scale=1">\n');
            res.write('<style>\np {\n\tfont-size: 10vw;\n}\n\n</style></head>\n');
            res.write('<body>\n');
            res.write('<p>Hello ' + mac + '!</p>\n');
            res.write('<p>Your vote has been deleted.</p>\n');
            res.write('</body>\n</html>\n');
            res.end();
            break;
        default:
            console.log('NaN : ' + url + '\n');
            render_results(req, res);
    }
})).listen(8080, '0.0.0.0'); // '0.0.0.0' forces IPv4 IP address (macfromip only supports IPv4)

console.log("Server listening on port 8080\n");
