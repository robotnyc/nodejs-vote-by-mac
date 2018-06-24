"use strict";

const http = require('http');
const { parse } = require('querystring');
const util = require('util');
const fs = require('fs');
const { exec } = require('child_process');

const config = require('./config.js');

// votes are stored in RAM
var votes = {};

function swap_key_value(json) {
  var ret = {};
  for(let key in json) {
    if (! ret.hasOwnProperty(json[key]))
      ret[json[key]] = [];
    ret[json[key]].push(key);
  }
  return ret;
}

async function get_index(req, res) {
    // render choices
    let choice_html = "";
    for (let choice = 1; choice <= config.choices; choice++) {
        if (choice in config.choice_names && config.choice_names[choice] != "")
            choice_html += `<a href="/${choice}">${choice} ${config.choice_names[choice]}</a> `;
        else
            choice_html += `<a href="/${choice}">${choice}</a> `;
    }

    // render votes
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

    // render results
    let rank = swap_key_value(results);
    let max = 0;
    let winners = {};
    for (let key in rank)
        if (key > max) {
            max = key;
            winners = rank[key];
        }
    let results_html = "";
    if (config.winner_only)
        for (let choice in winners)
            results_html += '\t<tr>\n\t\t<td>' + winners[choice] + '</td>\n\t\t<td>' + max + '</td>\n\t</tr>\n';
    else
        for (let choice in results)
            results_html += '\t<tr>\n\t\t<td>' + choice + '</td>\n\t\t<td>' + results[choice] + '</td>\n\t</tr>\n';

    // render page
    let data = (await util.promisify(fs.readFile)('./index.html', 'utf8'))
        .replace(/<title>Vote by MAC<\/title>/g, `<title>${config.title}</title>`)
        .replace(/<h1>Vote by MAC<\/h1>/g, `<h1>${config.title}</h1>`)
        .replace(/<span id="ul-choices" style="display:none;"><\/span>/g, choice_html)
        .replace(/<span id="tr-mac-vote" style="display:none;"><\/span>/g, votes_html)
        .replace(/<span id="tr-choice-count" style="display:none;"><\/span>/g, results_html);
    if (!config.show_votes)
        data = data.replace(/<votes>[\s\S]*?<\/votes>/g, '');
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write(data);
    res.end();
    return;
}

async function get_config(req, res) {
    let choice_html = "";
    for (var choice = 1; choice <= config.choices; choice++) {
        if (choice in config.choice_names)
            choice_html += `<input type="text" maxlength="40" name="${choice}" value="${config.choice_names[choice]}"/><br/>\n`;
        else
            choice_html += `<input type="text" maxlength="40" name="${choice}"/><br/>\n`;
    }
    let data = (await util.promisify(fs.readFile)('./config.html', 'utf8'))
        .replace(/<span id="input-choices" style="display:none;"><\/span>/g, choice_html);
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write(data);
    res.end();
    return;
}

async function post_config(req, res) {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    req.on('end', () => {
        config.choice_names = parse(body);
        for (let choice in config.choice_names)
            config.choice_names[choice] = config.choice_names[choice].replace(/[^0-9a-zA-Z_ ]/g, '');
        res.writeHead(301, {Location: '/'});
        res.end();
    });
}

http.createServer((async (req, res) => {
    // route config
    if (req.url == "/config") {
        if (req.method === 'GET')
            get_config(req, res);
        else if (req.method === 'POST')
            post_config(req, res);
        return;
    }

    var mac = (await util.promisify(exec)(`arp -n | awk '/${req.connection.remoteAddress}/{print $3;exit}'`)).stdout.trim();
    // MAC not found / invalid (e.g. localhost)
    if (!/^([0-9a-f]{2}[:-]){5}([0-9a-f]{2})$/.test(mac)) {
        get_index(req, res);
        return;
    }

    // process vote from URL server/#
    let url = req.url.replace(/^\/+/g, '');
    let data = "";
    switch (true) {
        case ((parseInt(url) > 0) && (parseInt(url) <= config.choices)):
            votes[mac] = url;
            data = (await util.promisify(fs.readFile)('./vote.html', 'utf8'))
                .replace(/<span id="mac"><\/span>/, `<span id="mac">${mac.replace(/([:-][0-9A-Fa-f]{2}){3}$/,':xx:xx:xx')}</span>`)
                .replace(/<span id="vote"><\/span>/, `<span id="vote">Your vote for ${parseInt(url)} has been recorded.</span>`);
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.write(data);
            res.end();
            break;
        case (parseInt(url) == 0):
            delete votes[mac];
            data = (await util.promisify(fs.readFile)('./vote.html', 'utf8'))
                .replace(/<span id="mac"><\/span>/, `<span id="mac">${mac.replace(/([:-][0-9A-Fa-f]{2}){3}$/,':xx:xx:xx')}</span>`)
                .replace(/<span id="vote"><\/span>/, `<span id="vote">Your vote has been deleted.</span>`);
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.write(data);
            res.end();
            break;
        default:
            get_index(req, res);
    }

})).listen(config.port, '0.0.0.0'); // '0.0.0.0' forces IPv4 IP address (arp only supports IPv4)

console.log(`Server listening on port ${config.port}`);
