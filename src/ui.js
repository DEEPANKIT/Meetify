export function createVideoElement(stream, userId = 'local', username = 'Anonymous', muted = false) {
  const videoContainer = document.createElement('div');
  videoContainer.className = 'relative';
  videoContainer.id = `video-container-${userId}`;

  const video = document.createElement('video');
  video.srcObject = stream;
  video.id = `${userId}-video`;
  video.autoplay = true;
  video.playsinline = true;
  video.muted = muted;
  video.className = 'w-full rounded-lg';

  const nameTag = document.createElement('span');
  nameTag.className = 'absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded';
  nameTag.textContent = username;

  videoContainer.appendChild(video);
  videoContainer.appendChild(nameTag);

  return videoContainer;
}

export function updateButtonState(button, enabled, enabledText, disabledText) {
  button.textContent = enabled ? enabledText : disabledText;
  button.className = `${enabled ? 'bg-blue-500' : 'bg-gray-500'} text-white px-4 py-2 rounded hover:opacity-90`;
}

export function showNotification(element, message, type = 'error') {
  element.textContent = message;
  element.className = `mt-4 p-4 rounded-lg text-center ${
    type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
  }`;
  element.classList.remove('hidden');
  setTimeout(() => {
    element.classList.add('hidden');
  }, 3000);
}