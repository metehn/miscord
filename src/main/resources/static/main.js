class MiscordApp {
    constructor() {
        console.log('MiscordApp constructor başlatıldı');
        
        this.socket = null;
        this.username = null;
        this.isConnected = false;
        this.isMuted = false;
        this.users = new Map();
        this.mediaStream = null;
        this.localConnection = null;
        this.remoteConnections = new Map();
        
        this.selfId = null;

        // RTCPeerConnection'lar: peerId -> pc
        this.peerConnections = new Map();

        // STUN (LAN dışı bağlantılarda gerekebilir; zor NAT için TURN de gerekir)
        this.rtcConfig = {
            iceServers: [
                { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }
            ]
        };
        
        const elementsFound = this.initializeElements();
        if (!elementsFound) {
            console.error('DOM elementleri bulunamadığı için uygulama başlatılamadı');
            return;
        }
        
        this.setupEventListeners();
        this.generateUsername();
        
        console.log('MiscordApp başarıyla başlatıldı');
    }
    
    initializeElements() {
        console.log('DOM elementlerini arıyorum...');
        
        this.joinBtn = document.getElementById('joinBtn');
        this.leaveBtn = document.getElementById('leaveBtn');
        this.muteBtn = document.getElementById('muteBtn');
        this.usernameSpan = document.getElementById('username');
        this.connectionStatus = document.getElementById('connectionStatus');
        this.usersList = document.getElementById('usersList');
        this.userCount = document.getElementById('userCount');

        console.log('Bulunan elementler:');
        console.log('joinBtn:', this.joinBtn);
        console.log('leaveBtn:', this.leaveBtn);
        console.log('muteBtn:', this.muteBtn);
        console.log('usernameSpan:', this.usernameSpan);
        console.log('connectionStatus:', this.connectionStatus);
        console.log('usersList:', this.usersList);
        console.log('userCount:', this.userCount);

        // Element kontrolü
        const missingElements = [];
        if (!this.joinBtn) missingElements.push('joinBtn');
        if (!this.leaveBtn) missingElements.push('leaveBtn');
        if (!this.muteBtn) missingElements.push('muteBtn');
        if (!this.usernameSpan) missingElements.push('username');
        if (!this.connectionStatus) missingElements.push('connectionStatus');
        if (!this.usersList) missingElements.push('usersList');
        if (!this.userCount) missingElements.push('userCount');

        if (missingElements.length > 0) {
            console.error('Eksik DOM elementleri:', missingElements);
            console.log('Mevcut tüm elementler:', document.querySelectorAll('*[id]'));
            return false;
        }
        
        console.log('Tüm DOM elementleri başarıyla bulundu!');
        return true;
    }
    
    setupEventListeners() {
        console.log('Event listener\'lar kuruluyor...');
        
        if (!this.joinBtn || !this.leaveBtn || !this.muteBtn) {
            console.error('Event listener kurma başarısız - elementler bulunamadı');
            return;
        }
        
        this.joinBtn.addEventListener('click', () => this.joinRoom());
        this.leaveBtn.addEventListener('click', () => this.leaveRoom());
        this.muteBtn.addEventListener('click', () => this.toggleMute());
        
        console.log('Event listener\'lar başarıyla kuruldu!');
    }
    
    generateUsername() {
        const adjectives = [
            'Hzlı', 'Güçlü', 'Akıllı', 'Cesur', 'Neşeli', 'Sakin', 'Enerjik', 'Yaratık',
            'Parlak', 'Sıcak', 'Soğuk', 'Renkli', 'Sessiz', 'Gürültülü', 'Heyecanlı', 'Rahat'
        ];
        const nouns = [
            'Aslan', 'Kartal', 'Köpek', 'Kedi', 'Ayı', 'Kurt', 'Tilki', 'Tavşan',
            'Panda', 'Kaplan', 'Fil', 'Zürafa', 'Penguen', 'Yunus', 'Köpekbalığı', 'Kaplumbağa'
        ];
        
        const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
        const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
        const randomNumber = Math.floor(Math.random() * 1000);
        
        this.username = `${randomAdjective}${randomNoun}${randomNumber}`;
        this.usernameSpan.textContent = this.username;
    }
    
    async joinRoom() {
        try {
            this.updateConnectionStatus('connecting', 'Bağlanıyor...');
            
            // Mikrofon izni al
            this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
                audio: { 
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }, 
                video: false 
            });
            
            // WebSocket bağlantısını kur
            this.connectWebSocket();
            
        } catch (error) {
            console.error('Mikrofon erişim hatası:', error);
            alert(`Mikrofon erişimi gerekli.\nHata: ${error?.name || 'Unknown'} - ${error?.message || ''}`);
            this.updateConnectionStatus('disconnected', 'Bağlantı başarısız');
        }
    }
    
    sendMessage(payload) {
        if (!this.socket) return;

        const data = JSON.stringify(payload);

        if (this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(data);
        } else {
            // CONNECTING/CLOSING/CLOSED durumunda sessizce geç
            console.warn('WebSocket açık değil, mesaj gönderilemedi:', payload);
        }
    }

    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/voice-chat`;

        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = function () {
            console.log('WebSocket bağlantısı kuruldu');

            this.isConnected = true;
            this.updateConnectionStatus('connected', 'Bağlı');
            this.updateUI(true);

            // Sunucuya kullanıcı bilgisi gönder
            this.sendMessage({
                type: 'join',
                username: this.username
            });
        }.bind(this);

        this.socket.onmessage = function (event) {
            const message = JSON.parse(event.data);
            Promise
                .resolve(this.handleMessage(message))
                .catch(err => console.error('handleMessage hatası:', err));
        }.bind(this);

        this.socket.onclose = function () {
            console.log('WebSocket bağlantısı kesildi');

            this.isConnected = false;
            this.updateConnectionStatus('disconnected', 'Bağlantı kesildi');
            this.updateUI(false);
            this.users.clear();
            this.updateUsersList();
        }.bind(this);

        this.socket.onerror = function (error) {
            console.error('WebSocket hatası:', error);
            this.updateConnectionStatus('disconnected', 'Bağlantı hatası');
        }.bind(this);
    }
    
    async handleMessage(message) {
        switch (message.type) {
            case 'users-list':
                // server: { type, selfId, users:[{id,username,status}] }
                this.selfId = message.selfId;
                this.updateUsers(message.users);

                // Yeni join olan taraf: mevcut herkese offer atsın
                for (const u of message.users) {
                    await this.startCallAsCaller(u.id);
                }
                break;

            case 'user-joined':
                // Existing kullanıcılar: sadece liste güncellesin (glare olmasın)
                this.addUser(message.user);
                break;

            case 'user-left':
                // server: {id, username}
                this.removeUser(message.id);
                this.closePeerConnection(message.id);
                break;

            case 'user-muted':
                this.updateUserStatus(message.id, 'muted');
                break;
            case 'user-unmuted':
                this.updateUserStatus(message.id, 'online');
                break;
            case 'user-speaking':
                this.updateUserStatus(message.id, 'speaking');
                break;
            case 'user-stopped-speaking':
                this.updateUserStatus(message.id, 'online');
                break;

            // WebRTC signaling
            case 'webrtc-offer':
                await this.onWebRtcOffer(message);
                break;
            case 'webrtc-answer':
                await this.onWebRtcAnswer(message);
                break;
            case 'webrtc-ice':
                await this.onWebRtcIce(message);
                break;
        }
    }

    updateUsers(users) {
        this.users.clear();
        users.forEach(user => {
            this.users.set(user.id, user);
        });
        this.updateUsersList();
    }

    addUser(user) {
        this.users.set(user.id, user);
        this.updateUsersList();
    }

    removeUser(id) {
        this.users.delete(id);
        this.updateUsersList();
    }

    updateUserStatus(id, status) {
        const user = this.users.get(id);
        if (user) {
            user.status = status;
            this.updateUsersList();
        }
    }

    ensurePeerConnection(peerId) {
        if (this.peerConnections.has(peerId)) return this.peerConnections.get(peerId);

        const pc = new RTCPeerConnection(this.rtcConfig);

        // local track'leri ekle
        if (this.mediaStream) {
            for (const track of this.mediaStream.getTracks()) {
                pc.addTrack(track, this.mediaStream);
            }
        }

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendMessage({
                    type: 'webrtc-ice',
                    to: peerId,
                    candidate: event.candidate
                });
            }
        };

        pc.ontrack = (event) => {
            const [remoteStream] = event.streams;
            if (remoteStream) this.attachRemoteAudio(peerId, remoteStream);
        };

        pc.onconnectionstatechange = () => {
            console.log('PC state', peerId, pc.connectionState);
        };

        this.peerConnections.set(peerId, pc);
        return pc;
    }

    async startCallAsCaller(peerId) {
        const pc = this.ensurePeerConnection(peerId);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        this.sendMessage({
            type: 'webrtc-offer',
            to: peerId,
            sdp: pc.localDescription
        });
    }

    async onWebRtcOffer(message) {
        const fromId = message.from;
        const pc = this.ensurePeerConnection(fromId);

        await pc.setRemoteDescription(new RTCSessionDescription(message.sdp));

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        this.sendMessage({
            type: 'webrtc-answer',
            to: fromId,
            sdp: pc.localDescription
        });
    }

    async onWebRtcAnswer(message) {
        const fromId = message.from;
        const pc = this.peerConnections.get(fromId);
        if (!pc) return;

        await pc.setRemoteDescription(new RTCSessionDescription(message.sdp));
    }

    async onWebRtcIce(message) {
        const fromId = message.from;
        const pc = this.peerConnections.get(fromId);
        if (!pc) return;

        try {
            await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
        } catch (e) {
            console.error('ICE add hatası:', e);
        }
    }

    attachRemoteAudio(peerId, stream) {
        let audio = document.getElementById(`audio-${peerId}`);
        if (!audio) {
            audio = document.createElement('audio');
            audio.id = `audio-${peerId}`;
            audio.autoplay = true;
            audio.playsInline = true;
            audio.style.display = 'none';
            document.body.appendChild(audio);
        }
        audio.srcObject = stream;
        audio.play().catch(() => {});
    }

    closePeerConnection(peerId) {
        const pc = this.peerConnections.get(peerId);
        if (pc) {
            try { pc.close(); } catch {}
            this.peerConnections.delete(peerId);
        }
        const audio = document.getElementById(`audio-${peerId}`);
        if (audio) audio.remove();
    }

    leaveRoom() {
        // peer'leri kapat
        for (const peerId of this.peerConnections.keys()) {
            this.closePeerConnection(peerId);
        }

        if (this.socket) {
            this.sendMessage({ type: 'leave' });
            this.socket.close();
        }
        
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
        
        this.isConnected = false;
        this.updateUI(false);
        this.users.clear();
        this.updateUsersList();
        this.updateConnectionStatus('disconnected', 'Bağlı değil');
    }
    
    toggleMute() {
        if (this.mediaStream) {
            const audioTrack = this.mediaStream.getAudioTracks()[0];
            if (audioTrack) {
                this.isMuted = !this.isMuted;
                audioTrack.enabled = !this.isMuted;
                
                this.muteBtn.textContent = this.isMuted ? 'Mikrofon: Kapalı' : 'Mikrofon: Açık';
                this.muteBtn.classList.toggle('muted', this.isMuted);
                
                // Sunucuya mute durumunu bildir
                this.sendMessage({
                    type: this.isMuted ? 'mute' : 'unmute'
                });
            }
        }
    }
    
    updateUsersList() {
        const usersArray = Array.from(this.users.values());
        this.userCount.textContent = usersArray.length;
        
        this.usersList.innerHTML = '';
        
        usersArray.forEach(user => {
            const userCard = document.createElement('div');
            userCard.className = 'user-card';
            
            const avatar = document.createElement('div');
            avatar.className = 'user-avatar';
            avatar.textContent = user.username.charAt(0).toUpperCase();
            
            const name = document.createElement('div');
            name.className = 'user-name';
            name.textContent = user.username;
            
            const statusDiv = document.createElement('div');
            statusDiv.className = 'user-status';
            
            const indicator = document.createElement('span');
            indicator.className = `status-indicator ${user.status || 'online'}`;
            
            let statusText = '';
            switch (user.status) {
                case 'speaking': statusText = 'Konuşuyor'; break;
                case 'muted': statusText = 'Sessiz'; break;
                default: statusText = 'Çevrimiçi';
            }
            
            statusDiv.appendChild(indicator);
            statusDiv.appendChild(document.createTextNode(statusText));
            
            userCard.appendChild(avatar);
            userCard.appendChild(name);
            userCard.appendChild(statusDiv);
            
            this.usersList.appendChild(userCard);
        });
        
        if (usersArray.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.style.textAlign = 'center';
            emptyMessage.style.color = '#666';
            emptyMessage.style.fontStyle = 'italic';
            emptyMessage.textContent = 'Henüz bağlı kullanıcı yok';
            this.usersList.appendChild(emptyMessage);
        }
    }
    
    updateConnectionStatus(status, message) {
        this.connectionStatus.className = `connection-status ${status}`;
        this.connectionStatus.textContent = `Bağlantı durumu: ${message}`;
    }
    
    updateUI(connected) {
        this.joinBtn.style.display = connected ? 'none' : 'block';
        this.leaveBtn.style.display = connected ? 'block' : 'none';
        this.muteBtn.style.display = connected ? 'block' : 'none';
        
        if (!connected) {
            this.isMuted = false;
            this.muteBtn.textContent = 'Mikrofon: Açık';
            this.muteBtn.classList.remove('muted');
        }
    }
}

// Sayfa yüklendiğinde uygulamayı başlat
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM içeriği yüklendi, MiscordApp başlatılıyor...');
    new MiscordApp();
});