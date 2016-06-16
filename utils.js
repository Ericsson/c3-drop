/*
 * Copyright (C) 2016 Ericsson AB. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

function Peer2Peer(opts) {
    this.session = opts.session || '';
    this.client = opts.client || '';
    this.room = null;
    this.hash = '';

    this._setupRoom = this._setupRoom.bind(this);
    this._identifySession = this._onIdentifySession.bind(this);
    this._onRoomCreated = this._onRoomCreated.bind(this);
}
Peer2Peer.prototype = {
    constructor: Peer2Peer,

    _setupRoom: function (test) {
        if (this.session) {
            return this.client.fetchRoomById(this.session)
                .then(function (room) {
                    return room.join();
                }, function (error) {
                    logError('Failed to fetch room!', error);
                });
        } else {
            console.log('Creating a room');
            return this.client.createRoom({
                joinRule: 'open',
                powerLevels: cct.PowerLevelsEdit.fromDefault(this.client.user)
                    .addState(0)
                    .userDefault(100)
                    .eventDefault(0)
                    .event('cct.room.data.share', 0),
            });
        }
    },

    _onIdentifySession: function () {
        this.hash = window.location.hash;
        if (this.hash) {
            this.session = this.hash.slice(1);
            console.log('Assigned sessionId:', this.session);
        }
    },

    _onRoomCreated: function (room) {
        this.room = room;
        window.location.hash = this.room.id;
        return this;
    },
};

Peer2Peer.prototype.start = function (client) {
    return cct.Auth.anonymous({serverUrl: getCctAddress()})
        .then(this.client.auth, function (error) {
            cct.log.error('error', error);
            logError('Failed to authenticate client');
            throw error;
        })
        .then(this._identifySession)
        .then(this._setupRoom)
        .then(this._onRoomCreated)
        .catch(function (error) {
            cct.log.error('error', error);
            logError('Failed to setup call');
        });
};

Peer2Peer.prototype.setupCall = function () {
    var members = this.room.otherMembers.slice();
    members.sort(function (a, b) {
        return b.lastActive - a.lastActive;
    });
    return this.room.startCall(members[0]);
};

var body = document.getElementsByTagName('body');

function toggleLog() { // eslint-disable-line no-unused-vars
    console.log('WARNING! No visible log implemented.');
    return;
    /*
    var toggleLog = document.getElementById('toggleLog');
    var footer = document.getElementById('footer');
    if (toggleLog.value === 'show log') {
        footer.style.height = '500px';
        toggleLog.value = 'hide log';

        setTimeout(function () {
            var counter = 0;
            var scrollDown = setInterval(function () {
                body[0].scrollTop += 25;
                counter++;
                if (counter > 20) {
                    clearInterval(scrollDown);
                }
            }, 5);
        }, 30);
    } else {
        footer.style.height = '';
        toggleLog.value = 'show log';
    }
    */
}

function showLog() {
    console.log('WARNING! No visible log implemented.');
    return;
    /*
    var toggleLog = document.getElementById('toggleLog');
    var footer = document.getElementById('footer');
    if (toggleLog.value === 'show log') {
        footer.style.height = '500px';
        toggleLog.value = 'hide log';
    }
    */
}

function clientsInARoom(url, count) { // eslint-disable-line no-unused-vars
    if (!count) {
        count = 2;
    }

    var clients = [];
    for (var i = 0; i < count; i++) {
        clients[i] = new cct.Client();
    }

    return Promise.all(clients.map(function (client) {
        return cct.Auth.anonymous({serverUrl: url}).then(client.auth);
    })).then(function (clients) {
        var rest = clients.slice(0, -1);
        return Promise.all(rest.map(function (client) {
            return client.once('invite').then(function (room) {
                return room.join();
            });
        }).concat(clients[clients.length - 1].createRoom({
            invite: rest.map(function (client) {
                return client.user;
            }),
        }))).then(function (rooms) {
            return {
                rooms: rooms,
                clients: clients,
            };
        });
    });
}

function logP(label) { // eslint-disable-line no-unused-vars
    return function (ret) {
        log(label, ret);
        return ret;
    };
}

function logPE(label) { // eslint-disable-line no-unused-vars
    return function (ret) {
        log(label + ' error', ret);
        showLog();
        throw ret;
    };
}

function log(label, ret) {
    var div = document.createElement('div');
    var tag = document.createElement('div');
    var content = document.createElement('pre');
    var str = ret;
    if (typeof (str) !== 'string') {
        str = JSON.stringify(str, null, '\u00a0\u00a0\u00a0\u00a0');
    }
    str = str.replace(/(?:\\r)?\\n/g, '\n');
    tag.textContent = label;
    content.textContent = str;
    console.log(label + ': ' + str);
    div.appendChild(tag);
    div.appendChild(content);
    if (document.getElementById('log')) {
        document.getElementById('log').appendChild(div);
    }
    return ret;
}

function logError(ret) {
    log('error', ret);
    showLog();
}

function getCctAddress() { // eslint-disable-line no-unused-vars
    return 'https://webrtc-test.cct.ericsson.net';
}

var EXAMPLE_UTILS_ICE_SERVERS = [ // eslint-disable-line no-unused-vars
    {
        urls: 'stun:mmt-stun.verkstad.net',
    },
    {
        urls: 'turn:static.verkstad.net:443?transport=tcp',
        username: 'openwebrtc',
        credential: 'secret',
    },
];
