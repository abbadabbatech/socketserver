"use strict";
// Optional. You will see this name in eg. 'ps' or 'top' command
process.title = 'LOOP-CHAT';
var DBHOST = 'devdb.clinicalsoftworks.com';
var DBUSER = 'robert';
var DBPASS = '!L00pL00p!';
var DBNAME = 'chatserver';
// Port where we'll run the websocket server
var webSocketsServerPort = 3001;
// websocket and http servers
var webSocketServer = require('websocket').server;
var http = require('http');
var mysql = require('mysql');
/**
 * Global variables
 */
// latest 100 messages
var history = [ ];
// list of currently connected clients (users)
var clients = [ ];
// List of active Channels
var channels = [ ];
/**
 * Helper function for escaping input strings
 */
function htmlEntities(str) {
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * HTTP server
 */
var server = http.createServer(function(request, response) {
    // Not important for us. We're writing WebSocket server,
    // not HTTP server
});
server.listen(webSocketsServerPort, function() {
    console.log((new Date()) + " Server is listening on port "
        + webSocketsServerPort);
});
/**
 * WebSocket server
 */
var wsServer = new webSocketServer({
    // WebSocket server is tied to a HTTP server. WebSocket
    // request is just an enhanced HTTP request. For more info
    // http://tools.ietf.org/html/rfc6455#page-6
    httpServer: server
});
// This callback function is called every time someone
// tries to connect to the WebSocket server
wsServer.on('request', function(request) {

    console.log((new Date()) + ' Connection from origin '
        + request.origin + '.');
    // accept connection - you should check 'request.origin' to
    // make sure that client is connecting from your website
    // (http://en.wikipedia.org/wiki/Same_origin_policy)
    var connection = request.accept(null, request.origin);
    // we need to know client index to remove them on 'close' event
    var index = clients.push(connection) - 1;
    var userName = false;
    var msgtype = '';
    var userColor = false;
    var sender = '';
    var receiver = '';
    var msg = '';
    var msgkey = '';
    var refid = '';
    console.log((new Date()) + ' Connection accepted.');
    // send back chat history
    if (history.length > 0) {
        connection.sendUTF(
            JSON.stringify({ type: 'history', data: history} ));
    }
    // user sent some message
    connection.on('message', function(message) {
        console.log('LOCATION0');
        console.log('MSG-FULL: '+JSON.stringify(message));
        var conn2 = mysql.createConnection({
            host: DBHOST,
            user: DBUSER,
            password: DBPASS,
            database: DBNAME
        });
        //conn2.connect();
        console.log('MSGTYPE: '+message.type);
        if (message.type === 'utf8') { // accept only text
            // first message sent by user is their name
            var msgdata = JSON.parse(message.utf8Data);
            console.log('MSG: '+msgdata);
            msgtype = msgdata.msgtype;
            // connect, typing, message
            if (msgtype === 'connect') {
                console.log('LOCATION1');
                // remember user name
                //userName = htmlEntities(message.utf8Data);
                userName = msgdata.userName;
                sender = msgdata.sender;
                receiver = msgdata.receiver;
                msg = msgdata.message;
                msgkey = msgdata.msgkey;
                refid = msgdata.refid;
                // get random color and send it back to the user
                //userColor = colors.shift();
                connection.sendUTF(JSON.stringify({ type:'connection', client: index }));
                console.log((new Date()) + ' User is known as: ' + userName + ' with clientID' + index +'.');
            } else if (msgtype === 'typing') {
                console.log('LOCATION2');
                userName = msgdata.fullname;
                msgkey = msgdata.msgkey;
                connection.sendUTF(JSON.stringify(({type:'typing', username: userName, msgkey: msgkey})));
            }
            else {
                // log and broadcast the message
                console.log('LOCATION3');
                console.log((new Date()) + ' Received Message from ' + userName + ': ' + message.utf8Data);
                userName = msgdata.fullname;
                sender = msgdata.sender;
                receiver = msgdata.receiver;
                msg = msgdata.message;
                msgkey = msgdata.msgid;
                refid = msgdata.refid;
                // we want to keep history of all sent messages
                var obj = {
                    time: (new Date()).getTime(),
                    text: htmlEntities(message.utf8Data),
                    sentby: userName
                };
                history.push(obj);
                history = history.slice(-100);
                // broadcast message to all connected clients
                var json = JSON.stringify({ type:'message', data: JSON.stringify(msgdata) });
                for (var i=0; i < clients.length; i++) {
                    clients[i].sendUTF(json);
                }
            }
        }
    });
    // user disconnected
    connection.on('close', function(connection) {
        if (userName !== false) {
            console.log((new Date()) + " Peer "
                + connection.remoteAddress + " disconnected.");
            // remove user from the list of connected clients
            clients.splice(index, 1);
            // push back user's color to be reused by another user
            //colors.push(userColor);
        }
    });
});
