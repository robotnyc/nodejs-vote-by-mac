"use strict";

const http = require('http');
const { parse } = require('querystring');
const util = require('util');
const fs = require('fs');
const { exec } = require('child_process');

var config = require('./config.js');

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

function results() {
    let results = {};
    for (var voter in votes) {
        let vote = votes[voter];
        if (vote in results)
            results[vote] += 1;
        else
            results[vote] = 1;
    }

    return results;
}

function winners() {
    let rank = swap_key_value(results());
    let max = 0;
    let winners = [];
    for (let key in rank)
        if (parseInt(key) > parseInt(max)) {
            max = key;
            winners = rank[key];
        }

    return winners;
}

async function get_index(req, res) {
    // render choices
    let choice_html = "";
    for (let choice = 1; choice <= config.choices; choice++) {
        if (choice in config.choice_names && config.choice_names[choice] != "")
            choice_html += `| <a href="/${choice}">${choice} ${config.choice_names[choice]}</a> `;
        else
            choice_html += `| <a href="/${choice}">${choice}</a> `;
    }
    choice_html += `|`;

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
            choice_html += `${choice}: <input type="text" maxlength="40" name="${choice}" value="${config.choice_names[choice]}"/><br>\n`;
        else
            choice_html += `${choice}: <input type="text" maxlength="40" name="${choice}"/><br>\n`;
    }
    let data = (await util.promisify(fs.readFile)('./config.html', 'utf8'))
        .replace(/<span id="input-choices" style="display:none;"><\/span>/g, choice_html)
        .replace(/id="title"/g, `id="title" value="${config.title}"`)
        .replace(/id="show_votes"/g, `id="show_votes" ${(config.show_votes ? "checked" : "unchecked")}`)
        .replace(/id="winner_only"/g, `id="winner_only" ${(config.winner_only ? "checked" : "unchecked")}`)
        .replace(/id="choices"/g, `id="choices_count" value="${config.choices}"`);
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
        let data = parse(body);
        for (var property in data) {
            if (property == "reset_names") {
                for (let choice in config.choice_names)
                   config.choice_names[choice] = "";
            } else if (property == "reset_votes") {
                for (var prop in votes)
                        delete votes[prop];
            } else if (typeof(config[property]) == "boolean") {
                if (Array.isArray(data[property]))
                    config[property] = true;
                else
                    config[property] = false;
            } else if (!isNaN(property))
                config.choice_names[property] = data[property];
            else
                config[property] = data[property];
        }
        // sanitize input
        config.title = config.title.replace(/[^0-9a-zA-Z_ ]/g, '')
        if (config.choices <= 0)
            config.choices = 2;
        for (let choice in config.choice_names)
            config.choice_names[choice] = config.choice_names[choice].replace(/[^0-9a-zA-Z_ ]/g, '');
        res.writeHead(301, {Location: '/'});
        res.end();
    });
}

async function get_winners(req, res) {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.write(JSON.stringify(winners()));
    res.end();
    return;
}

async function get_results(req, res) {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.write(JSON.stringify(results()));
    res.end();
    return;
}

async function get_votes(req, res) {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.write(JSON.stringify(votes));
    res.end();
    return;
}

http.createServer((async (req, res) => {
    // route config
    if (req.url == "/config") {
        if (req.method === 'GET')
            await get_config(req, res);
        else if (req.method === 'POST')
            await post_config(req, res);
        return;
    } else if (req.url == "/winners") {
        if (req.method === 'GET')
            await get_winners(req, res);
        return;
    } else if (req.url == "/results") {
        if (req.method === 'GET')
            await get_results(req, res);
        return;
    } else if (req.url == "/votes") {
        if (req.method === 'GET')
            await get_votes(req, res);
        return;
    } else if (req.url == "/random") {
        let n = Math.floor(Math.random() * Math.floor(99)) + 1; // return random two digit number from 10-19
        var mac = "00:11:22:33:44:" + n;
        var test_url = Math.floor(Math.random() * Math.floor(9)) + 1;
    } else {
        try {
            var mac = (await util.promisify(exec)(`arp -n | awk '/${req.connection.remoteAddress}/{print $3;exit}'`)).stdout.trim();
        } catch (error) {
            console.log("MAC lookup error: " + error);
        }
    }

    // MAC not found / invalid (e.g. localhost)
    if (!/^([0-9a-f]{2}[:-]){5}([0-9a-f]{2})$/.test(mac)) {
        get_index(req, res);
        return;
    }


    // process vote from URL server/#
    if (test_url)
        var url = test_url
    else
        var url = req.url.replace(/^\/+/g, '');
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
