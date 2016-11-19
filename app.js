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

function showSuccess() {
    $('.box__success').show();
    $('#box__progress').hide();
    $('.box__note').hide();
    hideInstructions();
}

function showError() {
    $('.box__error').show();
    $('.box__note').hide();
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
    cct.log.setLogLevel('file-ref', cct.log.ALL);
    cct.log.color = true;

    var progress = document.getElementById('box__progress');

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
                $('.box__instructions').text('Connecting...');
            }
        }
    } else {
        hideInstructions();
        start(client, roomId)
        window.addEventListener('hashchange', function () {
            location.reload()
        })
    }

    function start(client, roomId) {
        return connectionPromise
            .then(enterRoom.bind(0, roomId))
            .then(setupCall)
            .catch(function (error) {
                console.log('error: ', error)
                handleError('Failed to connect to server', error);
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
        window.room = room
        window.call = call

        var data = new cct.FileShare();
        call.attach('data', data);

        bindData(data);

        var statusText = document.getElementById('isConnected');
        call.on('connectionState', connectionState => {
            if (connectionState === 'connected') {
                statusText.textContent = 'Connected';
                statusText.style.color = 'rgba(0,255,0,0.5)';
            } else if (connectionState === 'connecting' || connectionState === 'signaling') {
                statusText.textContent = 'Connecting';
                statusText.style.color = 'rgba(255,255,0,0.5)';
            } else if (connectionState === 'failed' || connectionState === 'disconnected') {
                statusText.textContent = 'Connected';
                statusText.style.color = 'rgba(255,0,0,0.5)';
            }
        })
    }

    function bindData(data) {
        if (isInitiator) {
            hideBox();
            handleFiles(droppedFiles);
        } else {
            setupEvents(data)
        }

        function handleFiles(files) {
            for (var i = 0; i < files.length; i++) {

                var file = files[i];
                var fileRef = cct.FileRef.fromFile(file);
                data.set(fileRef.name, fileRef);
                var fileRefs = 0;

                fileRef.on('transfer', function (transfer) {

                    fileRefs++
                    var progressBar = document.createElement('progress');
                    progressBar.max = 1;
                    progress.appendChild(progressBar);

                    console.log('Transfer to ' + transfer.peer.id);
                    transfer.on('progress', function (progress) {
                        progressBar.value = progress;
                    });
                    transfer.on('done', function () {
                        console.log('Transfer to ' + transfer.peer.id + ' completed');
                        var ele = progress.getElementsByTagName('span');
                        if (ele.length !== 0) {
                            progress.removeChild(ele[0]);
                        }
                        fileRefs--
                        if(!fileRefs) {
                          showSuccess();
                        }
                    });
                    transfer.on('error', function (error) {
                        console.log('Transfer to ' + transfer.peer.id + ' failed: ', error);
                        showError();
                    });
                    transfer.on('end', function (reason) {
                        console.log('Transfer to ' + transfer.peer.id + ' ended: ' + reason);
                    });
                });
            }
        }

        function downloadFile(file) {
            var fileDownload = document.createElement('a');
            fileDownload.download = file.name;
            fileDownload.href = URL.createObjectURL(file);
            document.body.appendChild(fileDownload);
            fileDownload.click();
        }

        function setupEvents(data) {

            showProgress();

            var fileRefs = 0

            data.on('update', function (fileRef) {

                fileRefs++

                console.log('Got FileRef ' + fileRef.value);

                if (!isInitiator) {
                    var progressBar = document.createElement('progress');
                    progressBar.max = 1;
                    progressBar.value = 0;
                    progress.appendChild(progressBar);
                    fileRef.value.fetch().then(function (file) {
                        fileRefs--
                        if(!fileRefs) {
                          showSuccess();
                        }
                        downloadFile(file);
                    }).catch(function (error) {
                        cct.log.error('error', 'Failed to download file:', error);
                        logError('Failed to download file: ', error);
                        showError();
                    });
                }

                fileRef.value.on('progress', function (progressValue) {
                    progressBar.value = progressValue;
                });
            });
        }
    }
});
