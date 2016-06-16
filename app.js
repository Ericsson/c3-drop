function connect() {
    var conn = document.getElementById('isConnected');
    conn.textContent = 'Connected';
    conn.style.color = 'rgba(0,255,0,0.5)';
}

function hideBox() {
    $('.box').css('border', '0');
}

function hideInstructions() {
    $('.box__instructions').hide();
    $('.box__share').hide();
    hideBox();
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

$(document).ready(function() {

    var isAdvancedUpload = function() {
        var div = document.createElement('div');
        return (('draggable' in div) || ('ondragstart' in div && 'ondrop' in div)) && 'FormData' in window && 'FileReader' in window;
    }();

    if (!isAdvancedUpload) {
        alert('Your browser does not support drag-n-drop');
    }

    cct.log.setLogLevel(cct.log.ALL);
    cct.log.color = true;

    var progress = document.getElementById('box__progress');

    var link;
    var droppedFiles = false;
    var isInitiator = true;

    function setupListeners(room) {
        if (isInitiator) {
            peer.room.on('join', function (user) {
                console.log('User joined: ' + user);
                connect();
                log('Setup', 'Starting file sharing');
                var call = peer.setupCall();
                setupFileSharing(call);
            });
        } else {
            peer.room.on('call', function (call) {
                call.start();
                connect();

                setupFileSharing(call);
            });
        }
    }

    function setupFileSharing(call) {
        var fileShare = new cct.FileShare();
        call.attach('files', fileShare);

        setupEvents(fileShare);

        if (droppedFiles) {
            hideBox();
            handleFiles(droppedFiles);
        }

        function handleFiles(files) {
            for (var i = 0; i < files.length; i++) {

                var file = files[i];
                var fileRef = cct.FileRef.fromFile(file);
                fileShare.set('file', fileRef);
                var fileRefs = 0;

                fileRef.on('transfer', function (transfer) {

                    fileRefs++
                    var progressBar = document.createElement('progress');
                    progressBar.max = 1;
                    progress.appendChild(progressBar);

                    log('Transfer', 'Transfer to ' + transfer.peer.id);
                    transfer.on('progress', function (progress) {
                        progressBar.value = progress;
                    });
                    transfer.on('done', function () {
                        log('Transfer', 'Transfer to ' + transfer.peer.id + ' completed');
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
                        log('Transfer', 'Transfer to ' + transfer.peer.id + ' failed: ', error);
                        showError();
                    });
                    transfer.on('end', function (reason) {
                        log('Transfer', 'Transfer to ' + transfer.peer.id + ' ended: ' + reason);
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

        function setupEvents(fileShare) {

            showProgress();

            var fileRefs = 0

            fileShare.on('update:file', function (fileRef) {

                fileRefs++

                log('files', 'Got FileRef:', fileRef.name, fileRef);

                if (!isInitiator) {
                    var progressBar = document.createElement('progress');
                    progressBar.max = 1;
                    progressBar.value = 0;
                    progress.appendChild(progressBar);
                    fileRef.fetch().then(function (file) {
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

                fileRef.on('progress', function (progressValue) {
                    progressBar.value = progressValue;
                });
            });
        }
    }

    var hash = window.location.hash;
    var client = new cct.Client();
    var peer = new Peer2Peer({
        session: hash,
        client: client,
    });

    // Check if I was invited.
    isInitiator = !hash;

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
            droppedFiles = e.originalEvent.dataTransfer.files;

            peer.start()
                .then(setupListeners)
                .then(function () {
                    link = window.location.href;
                    $('.box__instructions').text('Share the following link with a friend:');
                    $('.box__share').show(400).text(link);
                })
                .catch(function (error) {
                    cct.log.error('error', error);
                    logError('Something went wrong');
                });
        });
    } else {
        hideInstructions();

        peer.start()
            .then(setupListeners)
            .then(function () {
                // TODO Something?
            })
            .catch(function (error) {
                cct.log.error('error', error);
                logError('Something went wrong');
            });
    }
});
