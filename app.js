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

function showConnecting() {
    $('.box__instructions').text('Connecting...');
    hideBox()
    hideButton();
}

function hideBox() {
    $('.box').css('border', '0');
}

function hideInstructions() {
    $('.box__instructions').hide();
    $('.box__share').hide();
    hideBox();
    hideButton();
}

function showProgress() {
    hideInstructions();
    $('#box__progress').show();
}

function hideProgress() {
    hideInstructions();
    $('.box__note').hide();
    $('#box__progress').hide();
    $('#isConnected').hide();
}

function showSuccess() {
    $('.box__success').show();
    hideProgress();
}

function showError(message) {
    $('.box__error').show();
    $('.box__error__message').text(message);
    hideProgress();
}

function isTouchDevice() {
    return (('ontouchstart' in window) || (navigator.MaxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0));
}

function showButton() {
    $('.box__button').show();
}

function hideButton() {
    $('.box__button').hide();
}

$(document).ready(function() {
    var isAdvancedUpload = function() {
        var div = document.createElement('div');
        return (('draggable' in div) || ('ondragstart' in div && 'ondrop' in div)) && 'FormData' in window && 'FileReader' in window;
    }();

    if (isTouchDevice()) {
        showButton();
    }

    if (!isAdvancedUpload) {
        alert('Your browser does not support drag-n-drop');
    }

    cct.log.setLogLevel(cct.log.INFO);
    cct.log.color = true;

    var client = new cct.Client({
        iceServers: EXAMPLE_UTILS_ICE_SERVERS
    });
    var connectionPromise = connectClient(client)
    window.client = client // to simplify debugging

    var link;
    var droppedFiles = false;
    var roomId = window.location.hash.slice(1);
    var isInitiator = !roomId;

    if (isInitiator) {
        var box = $('.box');
        box.on('drag dragstart dragend dragover dragenter dragleave drop', function(e) {
            e.preventDefault();
            e.stopPropagation();
        })
        .on('dragover dragenter', function() {
            box.addClass('is-dragover');
        })
        .on('dragleave dragend drop', function() {
            box.removeClass('is-dragover');
        })
        .on('drop', function(e) {
            onFiles(e.originalEvent.dataTransfer.files);
        });

        var fileSelector = $('<input type="file" multiple="">');

        var button = $('.box__button');
        button.on('click', function(e) {
            fileSelector.click();
        });
        fileSelector.on('change', function(e) {
            onFiles(e.target.files)
        });

        function onFiles(files) {
            if (!droppedFiles) {
                droppedFiles = files
                start(client)
                showConnecting()
            }
        }

        connectionPromise.catch(function (error) {
            console.log('Could not connect to server:', error)
            showError('Error! Could not connect to server')
        });
    } else {
        hideInstructions();
        start(client, roomId)
        showConnecting()
        window.addEventListener('hashchange', function () {
            location.reload()
        })
    }

    function start(client, roomId) {
        return connectionPromise
            .then(enterRoom.bind(0, roomId))
            .then(setupCall)
            .catch(function (error) {
                console.log('Could not connect to server:', error)
                showError('Error! Could not connect to server')
            });
    }

    function setupCall(room) {
        console.log('Setting up call');
        var call
        if (isInitiator) {
            call = room.startPassiveCall()
            $('.box__instructions').text('Share the following link with a friend:');
            $('.box__share').show(400).text(window.location.href + '#' + room.id);
        } else {
            let creator = room.state('m.room.create').get().creator
            call = room.startCall(creator)
        }

        // for easy debugging
        window.room = room;
        window.call = call;

        var fileShare = new cct.FileShare();
        call.attach('fileShare', fileShare);

        if (isInitiator) {
            handleLocalFiles(fileShare, droppedFiles);
        } else {
            handleRemoteFiles(fileShare)
        }

        call.on('connected', showProgress);

        let status = $('#isConnected')
        status.show()
        call.on('connectionState', connectionState => {
            if (connectionState === 'connected') {
                status.text('Connected');
                status.css('color', 'rgba(0,255,0,0.5)');
            } else if (connectionState === 'connecting' || connectionState === 'signaling') {
                status.text('Connecting');
                status.css('color', 'rgba(255,255,0,0.5)');
            } else if (connectionState === 'failed' || connectionState === 'disconnected') {
                status.text('Disconnected');
                status.css('color', 'rgba(255,0,0,0.5)');
            }
        })
    }

    function handleLocalFiles(fileShare, files) {
        var fileRefs = 0;

        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            var fileRef = cct.FileRef.fromFile(file);
            fileShare.set(fileRef.name, fileRef);

            fileRef.on('transfer', function (transfer) {
                fileRefs++
                console.log('Transfer to ' + transfer.peer.id);
                showProgressBar(transfer, transfer.once('end'))

                transfer.on('done', function () {
                    console.log('Transfer to ' + transfer.peer.id + ' completed');
                    fileRefs--
                    if(!fileRefs) {
                        showSuccess();
                    }
                });

                transfer.on('error', function (error) {
                    console.log('Transfer to ' + transfer.peer.id + ' failed: ', error);
                    showError('Error! Could not transfer file(s)');
                });
            });
        }
    }

    function handleRemoteFiles(fileShare) {
        var fileRefs = 0

        fileShare.on('update', function (update) {
            var fileRef = update.value
            fileRefs++
            transferFile(fileRef).then(function (file) {
                fileRefs--
                if(!fileRefs) {
                    showSuccess();
                }
            }).catch(function (error) {
                console.error('Failed to download file: ', error);
                showError('Error! Could not download file(s)');
            });
        });
    }

    function showProgressBar(target, completionPromise) {
        var progressBarBox = document.getElementById('box__progress');
        var progressBar = document.createElement('progress');
        progressBar.max = 1;
        progressBar.value = 0;
        progressBarBox.appendChild(progressBar);

        target.on('progress', function (progressValue) {
            progressBar.value = progressValue;
        });

        completionPromise.catch(function (error) {}).then(function () {
            progressBarBox.removeChild(progressBar);
        })
    }

    function transferFile(fileRef) {
        console.log('starting file download for ' + fileRef)
        if (window.downloadWithServiceWorker) {
            var download = window.downloadWithServiceWorker(fileRef)
            showProgressBar(download, download.promise)
            return download.promise
        } else {
            showProgressBar(fileRef, fileRef.fetch())
            return fileRef.fetch().then(function (file) {
                var anchor = document.createElement('a');
                anchor.download = file.name;
                anchor.href = URL.createObjectURL(file);
                document.body.appendChild(anchor);
                anchor.click();
                return file
            })
        }
    }
});
