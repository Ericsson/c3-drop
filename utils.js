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

var EXAMPLE_UTILS_ICE_SERVERS = [{
  urls: 'turn:turn.demo.c3.ericsson.net:443?transport=tcp',
  username: 'c3-turn',
  credential: 'see-three',
}, {
  urls: 'turn:turn.demo.c3.ericsson.net:443?transport=udp',
  username: 'c3-turn',
  credential: 'see-three',
}];

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
