import './style.css';
import { io } from 'socket.io-client';
import { createPeerConnection } from './webrtc.js';
import { createVideoElement, updateButtonState, showNotification } from './ui.js';

const socket = io('/', {
  transports: ['websocket'],
  reconnectionAttempts: 5
});

const peers = new Map();
let localStream;
let roomId;
let username;

const app = document.getElementById('app');
app.innerHTML = `
  <div class="min-h-screen p-4">
    <div class="max-w-4xl mx-auto">
      <div id="join-form" class="bg-white p-6 rounded-lg shadow-md mb-4">
        <h1 class="text-2xl font-bold mb-4">Join Video Call</h1>
        <div class="space-y-4">
          <div>
            <label for="username" class="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
            <input type="text" id="username" placeholder="Enter your name" 
                   class="w-full p-2 border rounded" required>
          </div>
          <div class="flex gap-2">
            <input type="text" id="room-id" placeholder="Enter Room ID" 
                   class="flex-1 p-2 border rounded" required>
            <button id="join-btn" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
              Join Room
            </button>
          </div>
        </div>
      </div>
      
      <div id="call-container" class="hidden">
        <div id="videos" class="grid grid-cols-2 gap-4 mb-4"></div>
        
        <div class="bg-white p-4 rounded-lg shadow-md flex justify-center gap-4">
          <button id="toggle-video" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
            Toggle Video
          </button>
          <button id="toggle-audio" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
            Toggle Audio
          </button>
          <button id="share-screen" class="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
            Share Screen
          </button>
          <button id="leave-call" class="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">
            Leave Call
          </button>
        </div>
        <div id="notification" class="hidden mt-4 p-4 rounded-lg text-center"></div>
      </div>
    </div>
  </div>
`;

const joinForm = document.getElementById('join-form');
const callContainer = document.getElementById('call-container');
const roomInput = document.getElementById('room-id');
const usernameInput = document.getElementById('username');
const joinBtn = document.getElementById('join-btn');
const toggleVideoBtn = document.getElementById('toggle-video');
const toggleAudioBtn = document.getElementById('toggle-audio');
const shareScreenBtn = document.getElementById('share-screen');
const leaveCallBtn = document.getElementById('leave-call');
const videosContainer = document.getElementById('videos');
const notification = document.getElementById('notification');

joinBtn.addEventListener('click', async () => {
  roomId = roomInput.value;
  username = usernameInput.value;

  if (!roomId || !username) {
    showNotification(notification, 'Please enter both your name and room ID');
    return;
  }

  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    const localVideoContainer = createVideoElement(localStream, 'local', username, true);
    videosContainer.appendChild(localVideoContainer);
    joinForm.classList.add('hidden');
    callContainer.classList.remove('hidden');
    socket.emit('join-room', { roomId, username });
  } catch (error) {
    console.error('Error accessing media devices:', error);
    showNotification(notification, 'Failed to access camera and microphone');
  }
});

socket.on('user-connected', async ({ userId, username: peerUsername }) => {
  console.log('User connected:', userId, peerUsername);
  const peerConnection = await createPeerConnection(userId, socket, localStream, (event) => {
    const [remoteStream] = event.streams;
    const remoteVideoContainer = createVideoElement(remoteStream, userId, peerUsername);
    videosContainer.appendChild(remoteVideoContainer);
  });
  
  peers.set(userId, peerConnection);
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit('offer', { offer, to: userId });
});

socket.on('offer', async ({ offer, from, username: peerUsername }) => {
  const peerConnection = await createPeerConnection(from, socket, localStream, (event) => {
    const [remoteStream] = event.streams;
    const remoteVideoContainer = createVideoElement(remoteStream, from, peerUsername);
    videosContainer.appendChild(remoteVideoContainer);
  });
  
  peers.set(from, peerConnection);
  await peerConnection.setRemoteDescription(offer);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit('answer', { answer, to: from });
});

socket.on('answer', async ({ answer, from }) => {
  const peerConnection = peers.get(from);
  if (peerConnection) {
    await peerConnection.setRemoteDescription(answer);
  }
});

socket.on('ice-candidate', async ({ candidate, from }) => {
  const peerConnection = peers.get(from);
  if (peerConnection) {
    await peerConnection.addIceCandidate(candidate);
  }
});

socket.on('user-disconnected', (userId) => {
  const videoContainer = document.getElementById(`video-container-${userId}`);
  if (videoContainer) {
    videoContainer.remove();
  }
  
  const peerConnection = peers.get(userId);
  if (peerConnection) {
    peerConnection.close();
    peers.delete(userId);
  }
});

toggleVideoBtn.addEventListener('click', () => {
  const videoTrack = localStream.getVideoTracks()[0];
  videoTrack.enabled = !videoTrack.enabled;
  updateButtonState(toggleVideoBtn, videoTrack.enabled, 'Toggle Video', 'Enable Video');
});

toggleAudioBtn.addEventListener('click', () => {
  const audioTrack = localStream.getAudioTracks()[0];
  audioTrack.enabled = !audioTrack.enabled;
  updateButtonState(toggleAudioBtn, audioTrack.enabled, 'Toggle Audio', 'Enable Audio');
});

shareScreenBtn.addEventListener('click', async () => {
  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const videoTrack = screenStream.getVideoTracks()[0];
    
    peers.forEach((peerConnection) => {
      const sender = peerConnection.getSenders().find(s => s.track.kind === 'video');
      sender.replaceTrack(videoTrack);
    });

    const localVideo = document.getElementById('local-video');
    localVideo.srcObject = new MediaStream([videoTrack]);
    
    videoTrack.onended = () => {
      const cameraTrack = localStream.getVideoTracks()[0];
      peers.forEach((peerConnection) => {
        const sender = peerConnection.getSenders().find(s => s.track.kind === 'video');
        sender.replaceTrack(cameraTrack);
      });
      localVideo.srcObject = localStream;
    };

    showNotification(notification, 'Screen sharing started', 'success');
  } catch (error) {
    console.error('Error sharing screen:', error);
    showNotification(notification, 'Screen sharing permission denied');
  }
});

leaveCallBtn.addEventListener('click', () => {
  localStream.getTracks().forEach(track => track.stop());
  peers.forEach((peerConnection) => peerConnection.close());
  peers.clear();
  socket.disconnect();
  callContainer.classList.add('hidden');
  joinForm.classList.remove('hidden');
  videosContainer.innerHTML = '';
  roomInput.value = '';
  usernameInput.value = '';
  showNotification(notification, 'Left the call', 'success');
});