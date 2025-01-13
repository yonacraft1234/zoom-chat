const socket = io();

const params = new URLSearchParams(window.location.search);
const username = params.get('username');
const room = params.get('room');

if (!username || !room) {
    alert('Username and room are required!');
    window.location.href = '/';
}

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
let localStream;
const peerConnections = {}; // Store peer connections for each user

const configuration = {
    iceServers: [
        { 
            urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302" ]
        }
    ]
};

console.log(`[DEBUG] Joining room: ${room} as ${username}`);
socket.emit('join-room', { room, username });

// Get the local media stream
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then((stream) => {
        console.log('[DEBUG] Local video stream captured.');
        localStream = stream;
        localVideo.srcObject = stream;
    })
    .catch((error) => {
        console.error('[ERROR] Failed to access media devices:', error);
    });

socket.on('user-joined', ({ id }) => {
    console.log(`[DEBUG] New user joined: ${id}`);
    createPeerConnection(id);
});

socket.on('signal', async (data) => {
    console.log(`[DEBUG] Signal received from ${data.from}:`, data);

    const { from, signal } = data;

    if (!peerConnections[from]) {
        createPeerConnection(from);
    }

    const peerConnection = peerConnections[from];

    if (signal.type === 'offer') {
        console.log('[DEBUG] Received an offer.');
        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
        console.log('[DEBUG] Remote description set successfully for offer.');
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        console.log('[DEBUG] Created and set local description for answer.');
        socket.emit('signal', { to: from, signal: peerConnection.localDescription });
    } else if (signal.type === 'answer') {
        console.log('[DEBUG] Received an answer.');
        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
        console.log('[DEBUG] Remote description set successfully for answer.');
    } else if (signal.candidate) {
        console.log('[DEBUG] Received an ICE candidate.');
        await peerConnection.addIceCandidate(new RTCIceCandidate(signal));
        console.log('[DEBUG] ICE candidate added successfully.');
    }
});

function createPeerConnection(targetSocketId) {
    console.log('[DEBUG] Creating new RTCPeerConnection.');
    const peerConnection = new RTCPeerConnection(configuration);
    peerConnections[targetSocketId] = peerConnection;

    remoteStream = new MediaStream();
    remoteVideo.srcObject = remoteStream;

    localStream.getTracks().forEach((track) => {
        console.log('[DEBUG] Adding local track to PeerConnection:', track);
        peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
            console.log('[DEBUG] Adding remote track:', track);
            remoteStream.addTrack(track);
        });
    };

    peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
            console.log('[DEBUG] Sending ICE candidate:', event.candidate);
            socket.emit('signal', { to: targetSocketId, signal: event.candidate });
        } else {
            console.log('[DEBUG] All ICE candidates have been sent.');
        }
    };

    

    console.log('[DEBUG] Creating offer for PeerConnection.');
    peerConnection.createOffer()
        .then((offer) => {
            console.log('[DEBUG] Offer created:', offer);
            return peerConnection.setLocalDescription(offer);
        })
        .then(() => {
            console.log('[DEBUG] Local description set successfully for offer.');
            socket.emit('signal', { to: targetSocketId, signal: peerConnection.localDescription });
        })
        .catch((error) => {
            console.error('[ERROR] Failed to create offer:', error);
        });

        console.log('[DEBUG] Creating answer for PeerConnection.');
        peerConnection.createAnswer()
            .then((answer) => {
                console.log('[DEBUG] Answer created:', answer);
                return peerConnection.setLocalDescription(answer);
            })
            .then(() => {
                console.log('[DEBUG] Local description set successfully for answer.');
                socket.emit('signal', { to: targetSocketId, signal: peerConnection.localDescription });
            })
            .catch((error) => {
                console.error('[ERROR] Failed to create answer:', error);
            });

            
    
}

socket.on('user-disconnected', ({ id }) => {
    console.log(`[DEBUG] User disconnected: ${id}`);
    if (peerConnections[id]) {
        peerConnections[id].close();
        delete peerConnections[id];
    }
    if (remoteVideo.srcObject && remoteVideo.srcObject.id === id) {
        remoteVideo.srcObject = null;
        console.log('[DEBUG] Cleared remote video.');
    }
});
