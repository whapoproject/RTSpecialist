document.addEventListener('DOMContentLoaded', function () {
    const messageList = document.getElementById('message-list');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const recordButton = document.getElementById('record-button');
    const badge = document.querySelector('.badge');  // Badge to show unread message count

    let unreadMessagesCount = 0;
    let mediaRecorder;
    let audioChunks = [];

    // Function to fetch messages and update unread count
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

                    // Count unread messages
                    if (msg.sender !== currentUsername && !msg.read) {
                        unreadMessagesCount++;
                    }
                });

                // Update the unread message count in the badge
                if (unreadMessagesCount > 0) {
                    badge.style.display = 'inline-block';
                    badge.textContent = unreadMessagesCount;
                } else {
                    badge.style.display = 'none';
                }

                messageList.scrollTop = messageList.scrollHeight;
            })
            .catch(error => console.error('Fetch error:', error));
    }

    // Mark messages as read when the user opens the chat
    function markMessagesAsRead() {
        fetch(`${sendUrl}?mark_read=true`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': csrfToken,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        })
        .then(response => {
            if (response.ok) {
                unreadMessagesCount = 0;
                badge.style.display = 'none'; // Hide badge after reading
            }
        })
        .catch(error => console.error('Error marking messages as read:', error));
    }

    // Handle message form submission
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

    // Handle voice recording
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

    // Mark messages as read when user enters the chat room
    markMessagesAsRead();

    setInterval(fetchMessages, 3000); // Poll every 3 seconds
});

