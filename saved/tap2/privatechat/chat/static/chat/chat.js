document.addEventListener('DOMContentLoaded', function () {
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const messageList = document.getElementById('message-list');
    const recordButton = document.getElementById('record-button');

    let mediaRecorder;
    let audioChunks = [];

    function fetchMessages() {
        fetch(fetchUrl)
            .then(response => response.json())
            .then(data => {
                messageList.innerHTML = '';

                const seen = new Set(); // Prevent duplicate render

                data.messages.forEach(msg => {
                    const msgKey = `${msg.sender}-${msg.content || msg.audio}-${msg.timestamp}`;
                    if (seen.has(msgKey)) return;
                    seen.add(msgKey);

                    const messageDiv = document.createElement('div');
                    messageDiv.classList.add('message');
                    messageDiv.classList.add(msg.sender === currentUsername ? 'sent' : 'received');

                    if (msg.audio) {
                        messageDiv.innerHTML = `<strong>${msg.sender}:</strong> <audio controls src="${msg.audio}"></audio><br><small>${msg.timestamp}</small>`;
                    } else {
                        messageDiv.innerHTML = `<strong>${msg.sender}:</strong> ${msg.content}<br><small>${msg.timestamp}</small>`;
                    }

                    messageList.appendChild(messageDiv);
                });

                messageList.scrollTop = messageList.scrollHeight;
            })
            .catch(error => console.error('Fetch error:', error));
    }

    messageForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const message = messageInput.value.trim();
        if (message === '') return;

        fetch(sendUrl, {
            method: 'POST',
            headers: {
                'X-CSRFToken': csrfToken,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'message=' + encodeURIComponent(message)
        })
        .then(response => {
            if (response.ok) {
                messageInput.value = '';
                // Let polling update the UI
            }
        })
        .catch(error => console.error('Send error:', error));
    });

    recordButton.addEventListener('click', async () => {
        if (!mediaRecorder || mediaRecorder.state === 'inactive') {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream);
                audioChunks = [];

                mediaRecorder.addEventListener('dataavailable', event => {
                    audioChunks.push(event.data);
                });

                mediaRecorder.addEventListener('stop', async () => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });

                    const formData = new FormData();
                    formData.append('audio', audioBlob, 'voice_message.webm');

                    await fetch(sendUrl, {
                        method: 'POST',
                        headers: {
                            'X-CSRFToken': csrfToken,
                        },
                        body: formData
                    });

                    // Let polling update the UI
                });

                mediaRecorder.start();
                recordButton.textContent = '🛑';
            } catch (error) {
                console.error('Microphone error:', error);
            }
        } else {
            mediaRecorder.stop();
            recordButton.textContent = '🎤';
        }
    });

    setInterval(fetchMessages, 3000); // Poll every 3 seconds
});

function scrollToBottom() {
    const messageList = document.getElementById('message-list');
    messageList.scrollTop = messageList.scrollHeight;
}

document.addEventListener("DOMContentLoaded", scrollToBottom);
