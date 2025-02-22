/*
 * Dark Souls 3 - Open Server
 * Copyright (C) 2021 Tim Leonard
 *
 * This program is free software; licensed under the MIT license.
 * You should have received a copy of the license along with this program.
 * If not, see <https://opensource.org/licenses/MIT>.
 */

const express = require('express');
const router = express.Router();

const config = require("../../../config/config.json")

var GActiveServers = [];

// Use lowercase patterns only.

// Filter list will block servers showing up in the loader.
var GFilters = [
    
];

// Censor list will replace name and description of server with a censored message.
var GCensors = [ 

];

var GOldestSupportedVersion = 2;

function IsFiltered(Name)
{
    var NameLower = Name.toLowerCase();
    for (var i = 0; i < GFilters.length; i++)
    {
        if (NameLower.includes(GFilters[i]))
        {
            return true;
        }
    }

    return false;
}

function IsCensored(Name)
{
    var NameLower = Name.toLowerCase();
    for (var i = 0; i < GCensors.length; i++)
    {
        if (NameLower.includes(GCensors[i]))
        {
            return true;
        }
    }

    return false;
}

function IsServerFilter(ServerInfo)
{
    if (ServerInfo['Version'] < GOldestSupportedVersion) {
        return true;
    }

    return  IsFiltered(ServerInfo['Name']) || 
            IsFiltered(ServerInfo['Description']) || 
            IsFiltered(ServerInfo['Hostname']);
}

function IsServerCensored(ServerInfo)
{
    return  IsCensored(ServerInfo['Name']) || 
            IsCensored(ServerInfo['Description']) || 
            IsCensored(ServerInfo['Hostname']);
}

function RemoveServer(IpAddress)
{
    for (var i = 0; i < GActiveServers.length; i++)
    {
        if (GActiveServers[i].IpAddress == IpAddress)
        {
            GActiveServers.splice(i, 1);
            break;
        }
    }
}

function AddServer(IpAddress, hostname, private_hostname, description, name, public_key, player_count, password, mods_white_list, mods_black_list, mods_required_list, version)
{
    var ServerObj = {
        "IpAddress": IpAddress,
        "Hostname": hostname,
        "PrivateHostname": private_hostname,
        "Description": description,
        "Name": name,
        "PublicKey": public_key,
        "PlayerCount": player_count,
        "Password": password,
        "ModsWhiteList": mods_white_list,
        "ModsBlackList": mods_black_list,
        "ModsRequiredList": mods_required_list,
        "UpdatedTime": Date.now(),
        "Version": version,
        "Censored": false
     };

    if (IsServerFilter(ServerObj))
    {
        return;
    }

    if (IsServerCensored(ServerObj))
    {
        ServerObj["Censored"] = true;
    }

    for (var i = 0; i < GActiveServers.length; i++)
    {
        if (GActiveServers[i].IpAddress == IpAddress)
        {
            GActiveServers[i] = ServerObj;
            return;
        }
    }

    GActiveServers.push(ServerObj);
    
    console.log(`Adding server: ip=${IpAddress} name=${name}`);
    console.log(`Total servers is now ${GActiveServers.length}`);
}

function RemoveTimedOutServers()
{
    var TimeoutOccured = false;
    var TimeoutDate = new Date(Date.now() - config.server_timeout_ms);
    for (var i = 0; i < GActiveServers.length; )
    {
        if (GActiveServers[i].UpdatedTime < TimeoutDate)
        {
            console.log(`Removing server that timed out: ip=${GActiveServers[i].IpAddress}`);

            GActiveServers.splice(i, 1);
            TimeoutOccured = true;
            break;
        }
        else
        {
            i++;
        }
    }

    if (TimeoutOccured)
    {
        console.log(`Total servers is now ${GActiveServers.length}`);
    }
}

// @route GET api/v1/servers
// @description Get a list of all active servers.
// @access Public
router.get('/', async (req, res) => {
    RemoveTimedOutServers();

    var ServerInfo = [];    
    for (var i = 0; i < GActiveServers.length; i++)
    {    
        var Server = GActiveServers[i];
        var DisplayName = Server["Name"];
        var DisplayDescription = Server["Description"];

        if (Server.Censored)
        {
            DisplayName = "[Censored]";
            DisplayDescription = "Censored by DS3OS, ask on discord to reinstate name/description.";
        }

        ServerInfo.push({
            "IpAddress": Server["IpAddress"],
            "Hostname": Server["Hostname"],
            "PrivateHostname": Server["PrivateHostname"],
            "Description": DisplayDescription,
            "Name": DisplayName,
            "PlayerCount": Server["PlayerCount"],
            "PasswordRequired": Server["Password"].length > 0,
            "ModsWhiteList": Server["ModsWhiteList"],
            "ModsBlackList": Server["ModsBlackList"],
            "ModsRequiredList": Server["ModsRequiredList"]
        });
    }

    res.json({ "status":"success", "servers": ServerInfo });
});

// @route POST api/v1/servers/:ip_address/public_key
// @description Get the public kley of a given server.
// @access Public
router.post('/:ip_address/public_key', async (req, res) => { 
    if (!('password' in req.body))
    {
        res.json({ "status":"error", "message":"Expected password in body." });
        return;        
    }

    var password = req.body["password"];
 
    for (var i = 0; i < GActiveServers.length; i++)
    {
        if (GActiveServers[i].IpAddress == req.params.ip_address)
        {
            if (password == GActiveServers[i].Password)
            {
                res.json({ "status":"success", "PublicKey":GActiveServers[i].PublicKey });
            }
            else
            {
                res.json({ "status":"error", "message":"Password was incorrect." });
            }
            return;
        }
    }

    res.json({ "status":"error", "message":"Failed to find server." });
});

// @route POST api/v1/servers
// @description Adds or updates the server registered to the clients ip.
// @access Public
router.post('/', async (req, res) => {
    if (!('Hostname' in req.body))
    {
        res.json({ "status":"error", "message":"Expected hostname in body." });
        return;        
    }
    if (!('PrivateHostname' in req.body))
    {
        res.json({ "status":"error", "message":"Expected private hostname in body." });
        return;        
    }
    if (!('Description' in req.body))
    {
        res.json({ "status":"error", "message":"Expected description in body." });
        return;        
    }
    if (!('Name' in req.body))
    {
        res.json({ "status":"error", "message":"Expected name in body." });
        return;        
    }
    if (!('PublicKey' in req.body))
    {
        res.json({ "status":"error", "message":"Expected public_key in body." });
        return;        
    }
    if (!('PlayerCount' in req.body))
    {
        res.json({ "status":"error", "message":"Expected player_count in body." });
        return;        
    }
    if (!('Password' in req.body))
    {
        res.json({ "status":"error", "message":"Expected password in body." });
        return;        
    }
    if (!('ModsWhiteList' in req.body))
    {
        res.json({ "status":"error", "message":"Expected mods_white_list in body." });
        return;        
    }
    if (!('ModsBlackList' in req.body))
    {
        res.json({ "status":"error", "message":"Expected mods_black_list in body." });
        return;        
    }
    if (!('ModsRequiredList' in req.body))
    {
        res.json({ "status":"error", "message":"Expected mods_required_list in body." });
        return;        
    }

    var hostname = req.body["Hostname"];
    var private_hostname = req.body["PrivateHostname"];
    var description = req.body["Description"];
    var name = req.body["Name"];
    var public_key = req.body["PublicKey"];
    var player_count = parseInt(req.body["PlayerCount"]);
    var password = req.body["Password"];
    var mods_white_list = req.body["ModsWhiteList"];
    var mods_black_list = req.body["ModsBlackList"];
    var mods_required_list = req.body["ModsRequiredList"];
    var version = ('ServerVersion' in req.body) ? parseInt(req.body['ServerVersion']) : 1;

    AddServer(req.connection.remoteAddress, hostname, private_hostname, description, name, public_key, player_count, password, mods_white_list, mods_black_list, mods_required_list, version);
    
    res.json({ "status":"success" });
});

// @route DELETE api/v1/servers
// @description Delete the server registered to the clients ip.
// @access Public
router.delete('/', (req, res) => { 
    RemoveServer(req.connection.remoteAddress);
    res.json({ "status":"success" });
});

module.exports = router;