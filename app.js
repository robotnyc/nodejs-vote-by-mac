"use strict";

const http = require('http');
const util = require('util');
const fs = require('fs');
const { exec } = require('child_process');

// votes are stored in RAM
var votes = {};

async function render_results(req, res) {
    let results = {};
    let votes_html = "";
    for (var voter in votes) {
        let vote = votes[voter];
        if (vote in results)
            results[vote] += 1;
        else
            results[vote] = 1;
        votes_html += `\t<tr>\n\t\t<td>${voter.replace(/([:-][0-9A-Fa-f]{2}){3}$/,':xx:xx:xx')}</td>\n\t\t<td>${votes[voter]}</td>\n\t</tr>\n`;
    }
    let results_html = "";
    for (var choice in results)
        results_html += '\t<tr>\n\t\t<td>' + choice + '</td>\n\t\t<td>' + results[choice] + '</td>\n\t</tr>\n';
    let data = (await util.promisify(fs.readFile)('./index.html', 'utf8'))
        .replace(/<span id="tr-mac-vote" style="display:none;"><\/span>/g, votes_html)
        .replace(/<span id="tr-choice-count" style="display:none;"><\/span>/g, results_html);
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write(data);
    res.end();
    return;
};

if (!isNaN(parseInt(process.argv[2])))
	var port = process.argv[2];
else
	var port = 80;

http.createServer((async (req, res) => {
    var mac = (await util.promisify(exec)(`arp -n | awk '/${req.connection.remoteAddress}/{print $3;exit}'`)).stdout.trim();

    // MAC not found / invalid (e.g. localhost)
    if (!/^([0-9a-f]{2}[:-]){5}([0-9a-f]{2})$/.test(mac)) {
        render_results(req, res);
        return;
    }

    // process vote from URL server/#
    let url = req.url.replace(/^\/+/g, '');
    switch (true) {
        case ((parseInt(url) > 0) && (parseInt(url) <= 100)):
            votes[mac] = url;
            var data = (await util.promisify(fs.readFile)('./vote.html', 'utf8'))
                .replace(/<span id="mac"><\/span>/, `<span id="mac">${mac.replace(/([:-][0-9A-Fa-f]{2}){3}$/,':xx:xx:xx')}</span>`)
                .replace(/<span id="vote"><\/span>/, `<span id="vote">Your vote for ${parseInt(url)} has been recorded.</span>`);
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.write(data);
            res.end();
            break;
        case (parseInt(url) == 0):
            delete votes[mac];
            var data = (await util.promisify(fs.readFile)('./vote.html', 'utf8'))
                .replace(/<span id="mac"><\/span>/, `<span id="mac">${mac.replace(/([:-][0-9A-Fa-f]{2}){3}$/,':xx:xx:xx')}</span>`)
                .replace(/<span id="vote"><\/span>/, `<span id="vote">Your vote has been deleted.</span>`);
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.write(data);
            res.end();
            break;
        default:
            render_results(req, res);
    }
})).listen(port, '0.0.0.0'); // '0.0.0.0' forces IPv4 IP address (arp only supports IPv4)

console.log(`Server listening on port ${port}\n`);
