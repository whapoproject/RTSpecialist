
document.addEventListener('DOMContentLoaded', function () {
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const messageList = document.getElementById('message-list');
    const recordButton = document.getElementById('record-button');
    const replyToInput = document.getElementById('reply-to-id');

    let mediaRecorder;
    let audioChunks = [];

    // Fetch messages manually
    function fetchMessages() {
        fetch(fetchUrl)
            .then(response => response.json())
            .then(data => {
                const seen = new Set();
                messageList.innerHTML = ''; // Clear old messages

                data.messages.forEach(msg => {
                    const msgKey = `${msg.sender}-${msg.content || msg.audio}-${msg.timestamp}`;
                    if (seen.has(msgKey)) return;
                    seen.add(msgKey);

                    const messageDiv = document.createElement('div');
                    messageDiv.classList.add('message');
                    messageDiv.classList.add(msg.sender === currentUsername ? 'sent' : 'received');
                    messageDiv.setAttribute('data-id', msg.id);

                    if (msg.reply_to) {
                        const replyBlock = document.createElement('div');
                        replyBlock.classList.add('reply-block');
                        replyBlock.innerHTML = `<small><strong>Replying to:</strong> ${msg.reply_to.content}</small>`;
                        messageDiv.appendChild(replyBlock);
                    }

                    const contentDiv = document.createElement('div');
                    contentDiv.classList.add('content');
                    if (msg.audio) {
                        contentDiv.innerHTML = `<audio controls src="${msg.audio}"></audio><br><small>${msg.timestamp}</small>`;
                    } else {
                        contentDiv.innerHTML = `${msg.content}<br><small>${msg.timestamp}</small>`;
                    }

                    if (msg.sender === currentUsername) {
                        const ticks = document.createElement('span');
                        ticks.classList.add('ticks');
                        ticks.textContent = msg.read ? '✓✓' : '✓';
                        contentDiv.appendChild(ticks);
                    }

                    messageDiv.appendChild(contentDiv);
                    messageList.appendChild(messageDiv);
                });

                messageList.scrollTop = messageList.scrollHeight;

                // Add reply event to all messages
                document.querySelectorAll('.message').forEach(msg => {
                    msg.addEventListener('click', () => {
                        const content = msg.querySelector('.content').innerText;
                        const id = msg.getAttribute('data-id');
                        messageInput.placeholder = "Replying to: " + content;
                        replyToInput.value = id;
                    });
                });
            })
            .catch(error => console.error('Fetch error:', error));
    }

    function markMessagesAsRead() {
        fetch(`${window.location.href}?mark_read=true`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': csrfToken,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }).then(response => {
            if (response.ok) {
                console.log('Messages marked as read');
            }
        });
    }

    if (window.location.search.includes('mark_read=true')) {
        markMessagesAsRead();
    }

    messageForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const message = messageInput.value.trim();
        const replyToId = replyToInput.value;
        if (!message) return;

        const bodyData = new URLSearchParams();
        bodyData.append('message', message);
        if (replyToId) bodyData.append('reply_to_id', replyToId);

        fetch(sendUrl, {
            method: 'POST',
            headers: {
                'X-CSRFToken': csrfToken,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: bodyData.toString()
        }).then(response => {
            if (response.ok) {
                messageInput.value = '';
                replyToInput.value = '';
                messageInput.placeholder = 'Type your message...';
                fetchMessages();
            }
        });
    });

    recordButton.addEventListener('click', async () => {
        if (!mediaRecorder || mediaRecorder.state === 'inactive') {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream);
                audioChunks = [];

                mediaRecorder.ondataavailable = event => {
                    audioChunks.push(event.data);
                };

                mediaRecorder.onstop = async () => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    const formData = new FormData();
                    formData.append('audio', audioBlob, 'voice_message.webm');
                    const replyToId = replyToInput.value;
                    if (replyToId) {
                        formData.append('reply_to_id', replyToId);
                    }

                    await fetch(sendUrl, {
                        method: 'POST',
                        headers: {
                            'X-CSRFToken': csrfToken,
                        },
                        body: formData
                    });

                    replyToInput.value = '';
                    messageInput.placeholder = 'Type your message...';
                    fetchMessages();
                };

                mediaRecorder.start();
                recordButton.textContent = '🛑';
            } catch (err) {
                console.error('Microphone error:', err);
            }
        } else {
            mediaRecorder.stop();
            recordButton.textContent = '🎤';
        }
    });

    fetchMessages();
});

