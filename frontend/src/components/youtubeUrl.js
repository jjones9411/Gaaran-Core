// Parsowanie linków YouTube/YouTube Music na potrzeby odtwarzacza w Profile.js

// Zamienia music.youtube.com na www.youtube.com (playlisty mają to samo ID)
export function normalizeYouTubeUrl(url) {
  let normalizedUrl = url.replace(/music\.youtube\.com\/playlist\?list=/i, 'www.youtube.com/playlist?list=');
  normalizedUrl = normalizedUrl.replace(/music\.youtube\.com\/watch\?v=/i, 'www.youtube.com/watch?v=');
  return normalizedUrl;
}

// Wyciąga video ID lub playlist ID z URL (w tym playlisty typu Like Radio/Mix)
export function parseYouTubeUrl(url) {
  const playlistMatch = url.match(/[?&]list=([^#&?]+)/);
  if (playlistMatch) {
    return { type: 'playlist', id: playlistMatch[1] };
  }

  const videoRegExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const videoMatch = url.match(videoRegExp);
  if (videoMatch && videoMatch[2].length === 11) {
    return { type: 'video', id: videoMatch[2] };
  }

  return null;
}
