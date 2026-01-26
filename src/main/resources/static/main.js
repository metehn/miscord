// Discord Alternative - Miscord
class MiscordApp {
    constructor() {
        this.channels = {
            'general-voice': { name: 'General', type: 'voice', messages: [], icon: '🔊', description: 'Voice channel for general discussions' },
            'music-voice': { name: 'Music', type: 'voice', messages: [], icon: '🎵', description: 'Share and listen to music together' },
            'gaming-voice': { name: 'Gaming', type: 'voice', messages: [], icon: '🎮', description: 'Voice chat for gaming sessions' },
            'general-text': { name: 'general', type: 'text', messages: [], icon: '#', description: 'General text discussions' },
            'random-text': { name: 'random', type: 'text', messages: [], icon: '#', description: 'Random conversations and memes' }
        };
        this.currentChannel = 'general-voice';
        this.currentUser = '';
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isRecording = false;
        this.recordingStartTime = null;
        this.initializeElements();
        this.loadData();
        this.setupEventListeners();
        this.updateUI();
        this.requestMicrophonePermission();
    }

    initializeElements() {
        this.messagesContainer = document.getElementById('messagesContainer');
        this.usernameInput = document.getElementById('usernameInput');
        this.recordButton = document.getElementById('recordButton');
        this.recordingStatus = document.getElementById('recordingStatus');
        this.channelTitle = document.getElementById('channelTitle');
        this.channelDescription = document.getElementById('channelDescription');
        this.usernameDisplay = document.getElementById('usernameDisplay');
        this.userAvatar = document.getElementById('userAvatar');
    }

    async requestMicrophonePermission() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            this.recordingStatus.textContent = "🎤 Ready to record voice messages";
        } catch (error) {
            console.error('Microphone permission denied:', error);
            this.recordingStatus.textContent = "❌ Microphone access required for voice chat";
            this.recordButton.disabled = true;
        }
    }

    setupEventListeners() {
        // Record button
        this.recordButton.addEventListener('click', () => this.toggleRecording());
        
        // Username input
        this.usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.recordButton.focus();
            }
        });

        this.usernameInput.addEventListener('input', () => {
            const username = this.usernameInput.value.trim();
            localStorage.setItem('miscordUsername', username);
            this.updateUserDisplay(username);
        });

        // Channel switching
        document.querySelectorAll('.channel').forEach(channel => {
            channel.addEventListener('click', () => {
                const channelId = channel.getAttribute('data-channel');
                this.switchChannel(channelId);
            });
        });

        // Load saved username
        const savedUsername = localStorage.getItem('miscordUsername');
        if (savedUsername) {
            this.usernameInput.value = savedUsername;
            this.updateUserDisplay(savedUsername);
        }
    }

    updateUserDisplay(username) {
        if (username) {
            this.usernameDisplay.textContent = username;
            this.userAvatar.textContent = username.charAt(0).toUpperCase();
            document.querySelector('.user-status').textContent = '🟢 Online';
        } else {
            this.usernameDisplay.textContent = 'Not logged in';
            this.userAvatar.textContent = '?';
            document.querySelector('.user-status').textContent = '🔴 Offline';
        }
    }

    switchChannel(channelId) {
        if (!this.channels[channelId]) return;
        
        // Update UI
        document.querySelectorAll('.channel').forEach(ch => ch.classList.remove('active'));
        document.querySelector(`[data-channel=\"${channelId}\"]`).classList.add('active');
        
        this.currentChannel = channelId;
        const channel = this.channels[channelId];
        
        this.channelTitle.textContent = channel.name;
        this.channelDescription.textContent = channel.description;
        document.querySelector('.channel-hash').textContent = channel.icon;
        
        // Show/hide record button based on channel type
        if (channel.type === 'voice') {
            this.recordButton.style.display = 'flex';
            this.recordingStatus.textContent = '🎤 Ready to record voice messages';
        } else {
            this.recordButton.style.display = 'none';
            this.recordingStatus.textContent = '💬 Text channels coming soon...';
        }
        
        this.updateUI();
    }

    loadData() {
        const savedData = localStorage.getItem('miscordData');
        if (savedData) {
            const data = JSON.parse(savedData);
            this.channels = { ...this.channels, ...data };
        }
    }

    saveData() {
        localStorage.setItem('miscordData', JSON.stringify(this.channels));
    }

    async toggleRecording() {
        if (!this.isRecording) {
            await this.startRecording();
        } else {
            this.stopRecording();
        }
    }

    async startRecording() {
        const username = this.usernameInput.value.trim();
        if (!username) {
            alert('Please enter your name first!');
            this.usernameInput.focus();
            return;
        }

        // Only allow recording in voice channels
        const channel = this.channels[this.currentChannel];
        if (channel.type !== 'voice') {
            alert('Voice messages can only be sent in voice channels!');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.recordedChunks = [];
            this.isRecording = true;
            this.recordingStartTime = Date.now();

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                this.processRecording();
                stream.getTracks().forEach(track => track.stop());
            };

            this.mediaRecorder.start();
            this.updateRecordingUI();
        } catch (error) {
            console.error('Error starting recording:', error);
            alert('Error accessing microphone. Please check permissions.');
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.updateRecordingUI();
        }
    }

    updateRecordingUI() {
        const recordButtonText = this.recordButton.querySelector('span');
        if (this.isRecording) {
            recordButtonText.textContent = 'Stop';
            this.recordButton.classList.add('recording');
            this.recordingStatus.textContent = '🔴 Recording... Click stop when finished';
        } else {
            recordButtonText.textContent = 'Record';
            this.recordButton.classList.remove('recording');
            this.recordingStatus.textContent = '🎤 Ready to record voice messages';
        }
    }

    async processRecording() {
        const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
        const duration = Math.floor((Date.now() - this.recordingStartTime) / 1000);
        
        if (duration < 1) {
            this.recordingStatus.textContent = '⚠️ Recording too short, try again';
            setTimeout(() => {
                this.recordingStatus.textContent = '🎤 Ready to record voice messages';
            }, 2000);
            return;
        }
        
        const reader = new FileReader();
        reader.onloadend = () => {
            const audioData = reader.result;
            this.saveVoiceMessage(audioData, duration);
        };
        reader.readAsDataURL(blob);
    }

    saveVoiceMessage(audioData, duration) {
        const username = this.usernameInput.value.trim();
        const message = {
            id: Date.now() + Math.random(),
            username: username,
            audioData: audioData,
            duration: duration,
            timestamp: new Date().toLocaleTimeString(),
            type: 'voice',
            channel: this.currentChannel
        };

        this.channels[this.currentChannel].messages.push(message);
        this.saveData();
        this.updateUI();
        this.scrollToBottom();
        
        this.recordingStatus.textContent = '✅ Voice message sent!';
        setTimeout(() => {
            this.recordingStatus.textContent = '🎤 Ready to record voice messages';
        }, 2000);
    }

    updateUI() {
        this.renderMessages();
    }

    renderMessages() {
        this.messagesContainer.innerHTML = '';
        
        const messages = this.channels[this.currentChannel].messages;
        messages.forEach(message => {
            const messageElement = this.createVoiceMessageElement(message);
            this.messagesContainer.appendChild(messageElement);
        });

        if (messages.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.style.textAlign = 'center';
            emptyState.style.color = '#72767d';
            emptyState.style.marginTop = '20px';
            emptyState.innerHTML = `
                <p>This is the beginning of the <strong>#${this.channels[this.currentChannel].name}</strong> channel.</p>
                <p style="margin-top: 8px;">${this.channels[this.currentChannel].description}</p>
            `;
            this.messagesContainer.appendChild(emptyState);
        }
    }

    createVoiceMessageElement(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'voice-message';
        
        const playButtonId = `play-${message.id}`;
        const audioId = `audio-${message.id}`;
        const userInitial = message.username.charAt(0).toUpperCase();
        
        messageDiv.innerHTML = `
            <div class="message-avatar">${userInitial}</div>
            <div class="message-content">
                <div class="message-header">
                    <span class="username">${this.escapeHtml(message.username)}</span>
                    <span class="timestamp">Today at ${message.timestamp}</span>
                </div>
                <div class="voice-controls">
                    <button class="play-button" id="${playButtonId}">▶</button>
                    <span class="voice-duration">${message.duration}s</span>
                    <audio id="${audioId}" src="${message.audioData}" preload="metadata"></audio>
                </div>
            </div>
        `;

        // Add play functionality
        const playButton = messageDiv.querySelector(`#${playButtonId}`);
        const audio = messageDiv.querySelector(`#${audioId}`);
        
        playButton.addEventListener('click', () => {
            if (audio.paused) {
                // Stop all other playing audio
                document.querySelectorAll('audio').forEach(a => {
                    if (!a.paused) {
                        a.pause();
                        a.currentTime = 0;
                    }
                });
                document.querySelectorAll('.play-button').forEach(btn => btn.textContent = '▶');
                
                audio.play();
                playButton.textContent = '⏸';
            } else {
                audio.pause();
                audio.currentTime = 0;
                playButton.textContent = '▶';
            }
        });

        audio.addEventListener('ended', () => {
            playButton.textContent = '▶';
        });

        return messageDiv;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    clearCurrentChannel() {
        if (confirm(`Are you sure you want to clear all messages in #${this.channels[this.currentChannel].name}?`)) {
            this.channels[this.currentChannel].messages = [];
            this.saveData();
            this.updateUI();
        }
    }
}

// Initialize the Miscord app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const miscordApp = new MiscordApp();
    
    // Add a clear channel function to window for debugging
    window.clearChannel = () => miscordApp.clearCurrentChannel();
    
    console.log('🎉 Miscord (Discord Alternative) initialized!');
    console.log('📝 Available commands:');
    console.log('  - clearChannel(): Clear current channel messages');
    console.log('🎤 Switch between voice channels to record messages!');
});