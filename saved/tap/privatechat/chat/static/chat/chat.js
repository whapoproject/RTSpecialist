document.addEventListener('DOMContentLoaded', function () {
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const messageList = document.getElementById('message-list');
    const recordButton = document.getElementById('record-button');
    const chatWindow = document.getElementById('chat-window');
    const chatUsers = document.getElementById('chat-users');
    const backButton = document.getElementById('back-button');

    let mediaRecorder;
    let audioChunks = [];

    function fetchMessages() {
        fetch(fetchUrl)
            .then(response => response.json())
            .then(data => {
                messageList.innerHTML = '';
                data.messages.forEach(msg => {
                    const messageDiv = document.createElement('div');
                    messageDiv.classList.add('message');
                    messageDiv.classList.add(msg.sender === currentUsername ? 'sent' : 'received');

                    if (msg.audio) {
                        messageDiv.innerHTML = `<strong>${msg.sender}:</strong> <audio controls src="${msg.audio}"></audio>`;
                    } else {
                        messageDiv.innerHTML = `<strong>${msg.sender}:</strong> ${msg.content}`;
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
                    fetchMessages();
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

                    fetchMessages();
                });

                mediaRecorder.start();
                recordButton.textContent = '🛑'; // Change to stop
            } catch (error) {
                console.error('Microphone error:', error);
            }
        } else {
            mediaRecorder.stop();
            recordButton.textContent = '🎤'; // Reset
        }
    });

    setInterval(fetchMessages, 3000); // Poll every 3 seconds

    // Function to toggle chat view on mobile devices
    function toggleChatView() {
        chatUsers.style.display = chatWindow.style.display === 'none' ? 'block' : 'none';
        chatWindow.style.display = chatWindow.style.display === 'none' ? 'block' : 'none';
        backButton.style.display = chatWindow.style.display === 'block' ? 'inline-block' : 'none';
    }

    // Back button to return to user list
    backButton.addEventListener('click', function () {
        toggleChatView(); // Switch to the user list view
    });

    // If a user is selected, toggle chat view to show the chat window
    const selectedUser = "{{ selected_user.username }}";
    if (selectedUser) {
        toggleChatView();
    }
});

// Auto-scroll to the bottom when the page loads or messages are added
function scrollToBottom() {
    const messageList = document.getElementById('message-list');
    messageList.scrollTop = messageList.scrollHeight;
}

document.addEventListener("DOMContentLoaded", scrollToBottom);
