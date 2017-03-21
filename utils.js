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

var SERVER_URL = 'https://demo.c3.ericsson.net'

var EXAMPLE_UTILS_ICE_SERVERS = [ // eslint-disable-line no-unused-vars
    {
        urls: 'stun:mmt-stun.verkstad.net',
    },
    {
        urls: 'turn:static.verkstad.net:443?transport=tcp',
        username: 'openwebrtc',
        credential: 'secret',
    },
    {urls: 'stun:23.21.150.121'},
    {urls:'stun:stun1.l.google.com:19302'},
    {urls:'stun:stun2.l.google.com:19302'},
    {urls:'stun:stun3.l.google.com:19302'},
    {
        urls: 'TURN:192.75.89.50:3478?transport=udp',
        credential : 'ericsson246',
        username: 'ericsson246'
    },
    {
        urls: 'TURN:192.75.89.50:3478?transport=tcp',
        credential : 'ericsson246',
        username: 'ericsson246'
    },
    {
        urls: 'turn:numb.viagenie.ca',
        credential: 'muazkh',
        username: 'webrtc@live.com'
    },
    {
        urls: 'turn:192.158.29.39:3478?transport=udp',
        credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
        username: '28224511:1379330808'
    },
    {
        urls: 'turn:192.158.29.39:3478?transport=tcp',
        credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
        username: '28224511:1379330808'
    }
];

function connectClient(client) {
    return cct.Auth.anonymous({
        iceServers: EXAMPLE_UTILS_ICE_SERVERS,
        serverUrl: SERVER_URL
    }).then(client.auth);
}

function enterRoom(roomId, client) {
    if (roomId) {
        console.log('Joining existing room ' + roomId);
        return client.getRoom(roomId).join();
    } else {
        console.log('Creating a new room');
        return client.createRoom({joinRule: 'open'});
    }
}

function tryRegisterServiceWorker() {
    if (!navigator.serviceWorker || !window.ReadableStream) {
        return Promise.resolve()
    }
    return navigator.serviceWorker.register('/downloadproxy.js').then(function (registration) {
        window.registration = registration;
        console.log('Registered service worker');
        return navigator.serviceWorker.ready;
    }).then(function () {
        console.log('Service worker is ready');
        if (!navigator.serviceWorker.controller) {
            var error = new Error('Service worker needs reload to be in control')
            error.name = 'NeedsReloadError'
            throw error
        }

        window.downloadWithServiceWorker = function (fileRef) {
            var channel = new MessageChannel();
            var port = channel.port1;

            port.onmessage = function (event) {
                var anchor = document.createElement('a');
                anchor.href = event.data.url;
                anchor.click();
                port.onmessage = null;
            }

            navigator.serviceWorker.controller.postMessage({
                type: 'start-download',
                name: fileRef.name,
                size: fileRef.size,
            }, [channel.port2]);

            var stream = fileRef.stream();

            stream.on('chunk', function (chunk) {
                port.postMessage({
                    type: 'chunk',
                    chunk: chunk,
                });
            })

            stream.promise.then(function () {
                port.postMessage({type: 'done'});
            })

            stream.promise.catch(function (error) {
                port.postMessage({type: 'error', error: error});
            })

            return stream;
        }
    })
}
