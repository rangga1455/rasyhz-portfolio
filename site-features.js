/**
 * site-features.js - LXVOID COMMUNITY Shared Features
 * 1. Global Announcement Ticker (from Firestore site_settings/announcement)
 * 2. Trending Lo-Fi & Custom Owner Music Player (YouTube, Direct MP3, & Uploaded Audio)
 *    with Cross-Page Continuous Playback & Mobile-Compact / Collapsible UI
 */

(function () {
    'use strict';

    // ================= 1. GLOBAL ANNOUNCEMENT BANNER =================
    async function initAnnouncement() {
        if (sessionStorage.getItem('lxvoid_announcement_closed')) return;

        // Jangan tampilkan banner pengumuman di halaman Sosial / Links (links.html)
        const path = window.location.pathname.toLowerCase();
        if (path.endsWith('links.html') || path.endsWith('/links') || path.endsWith('/links/') || document.body.classList.contains('lynkid-body')) {
            return;
        }

        const projectId = 'ff-ft-1c86d';
        const docUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/site_settings/announcement`;

        try {
            const res = await fetch(docUrl);
            if (!res.ok) return;
            const data = await res.json();
            const fields = data.fields;
            if (!fields) return;

            const active = fields.active?.booleanValue;
            const text = fields.text?.stringValue;
            const tag = fields.tag?.stringValue || 'INFO RESMI';
            const url = fields.url?.stringValue;

            if (active && text) {
                const bar = document.createElement('div');
                bar.className = 'announcement-bar';
                bar.id = 'global-announcement-bar';

                let contentHtml = `<span class="announcement-tag">📢 ${escapeHtml(tag)}</span>`;
                if (url) {
                    contentHtml += `<span class="announcement-text"><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a></span>`;
                } else {
                    contentHtml += `<span class="announcement-text">${escapeHtml(text)}</span>`;
                }

                bar.innerHTML = `
                    <div class="announcement-main">${contentHtml}</div>
                    <button type="button" class="announcement-close-btn" title="Tutup Pengumuman" aria-label="Tutup">&times;</button>
                `;

                bar.querySelector('.announcement-close-btn').addEventListener('click', () => {
                    bar.style.opacity = '0';
                    bar.style.height = '0';
                    bar.style.padding = '0';
                    setTimeout(() => bar.remove(), 300);
                    sessionStorage.setItem('lxvoid_announcement_closed', '1');
                });

                document.body.insertAdjacentElement('afterbegin', bar);
            }
        } catch (e) {
            console.debug('Announcement check:', e.message);
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
    }

    // ================= 2. TRENDING & CUSTOM OWNER PLAYLIST =================
    const DEFAULT_PLAYLIST = [
        {
            title: "Death Bed (Coffee)",
            artist: "Powfu / Beabadoobee",
            type: "direct",
            src: "https://cdn.jsdelivr.net/gh/pramit-marattha/lofi-music-player-vanilla-javascript@master/sounds/songs/Death%20Bed.mp3"
        },
        {
            title: "I'm Closing My Eyes",
            artist: "potsu ft. Shiloh Dynasty",
            type: "direct",
            src: "https://cdn.jsdelivr.net/gh/pramit-marattha/lofi-music-player-vanilla-javascript@master/sounds/songs/i%27m%20closing%20my%20eyes%20(feat.%20shiloh).mp3"
        },
        {
            title: "Can We Kiss Forever?",
            artist: "Kina ft. Adriana Proenza",
            type: "direct",
            src: "https://cdn.jsdelivr.net/gh/pramit-marattha/lofi-music-player-vanilla-javascript@master/sounds/songs/Can%20We%20Kiss%20Forever%20.mp3"
        },
        {
            title: "5:32 PM (Chill Beats)",
            artist: "The Deli",
            type: "direct",
            src: "https://cdn.jsdelivr.net/gh/pramit-marattha/lofi-music-player-vanilla-javascript@master/sounds/songs/5%2032pm.mp3"
        },
        {
            title: "Affection",
            artist: "Jinsang",
            type: "direct",
            src: "https://cdn.jsdelivr.net/gh/pramit-marattha/lofi-music-player-vanilla-javascript@master/sounds/songs/Affection.mp3"
        },
        {
            title: "Controlla (Lo-Fi)",
            artist: "Idealism",
            type: "direct",
            src: "https://cdn.jsdelivr.net/gh/pramit-marattha/lofi-music-player-vanilla-javascript@master/sounds/songs/controlla.mp3"
        },
        {
            title: "Coffee Breath",
            artist: "Sofia Mills Lofi",
            type: "direct",
            src: "https://cdn.jsdelivr.net/gh/pramit-marattha/lofi-music-player-vanilla-javascript@master/sounds/songs/Coffee%20Breath.mp3"
        },
        {
            title: "My New Love",
            artist: "Elijah Who",
            type: "direct",
            src: "https://cdn.jsdelivr.net/gh/pramit-marattha/lofi-music-player-vanilla-javascript@master/sounds/songs/my%20new%20love.mp3"
        },
        {
            title: "Walk But in a Garden",
            artist: "LLusion",
            type: "direct",
            src: "https://cdn.jsdelivr.net/gh/pramit-marattha/lofi-music-player-vanilla-javascript@master/sounds/songs/walk%20but%20in%20a%20garden.mp3"
        },
        {
            title: "Warm Breeze",
            artist: "Lofi Girl Aesthetic",
            type: "direct",
            src: "https://cdn.jsdelivr.net/gh/pramit-marattha/lofi-music-player-vanilla-javascript@master/sounds/songs/warm%20breeze.mp3"
        }
    ];

    let activePlaylist = [...DEFAULT_PLAYLIST];
    let audio = null;
    let ytPlayer = null;
    let ytReady = false;
    let pendingYTAction = null;
    let isPlaying = false;
    let currentTrackIndex = 0;
    let saveTimeThrottle = null;
    const blobCache = {}; // In-memory Blob URL cache

    // Fetch custom music added by Owner in Firestore
    async function fetchCustomMusic() {
        const projectId = 'ff-ft-1c86d';
        const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/custom_music`;
        try {
            const res = await fetch(url);
            if (!res.ok) return [];
            const data = await res.json();
            if (!data.documents) return [];

            const customList = [];
            data.documents.forEach(doc => {
                const f = doc.fields;
                if (!f) return;
                const active = f.active?.booleanValue !== false;
                if (!active) return;

                const id = doc.name.split('/').pop();
                const type = f.type?.stringValue || 'direct'; // 'youtube' | 'direct' | 'uploaded'
                const title = f.title?.stringValue || 'Custom Track';
                const artist = f.artist?.stringValue || 'Custom Music';
                const trackUrl = f.url?.stringValue || '';
                const youtubeId = f.youtubeId?.stringValue || '';
                const numChunks = parseInt(f.numChunks?.integerValue || '0', 10);
                const mimeType = f.mimeType?.stringValue || 'audio/mpeg';

                customList.push({
                    id: id,
                    title: title,
                    artist: artist,
                    type: type,
                    src: trackUrl,
                    youtubeId: youtubeId,
                    numChunks: numChunks,
                    mimeType: mimeType,
                    isCustom: true
                });
            });

            return customList;
        } catch (e) {
            console.debug('Custom music check:', e.message);
            return [];
        }
    }

    // Initialize YouTube IFrame Background Player
    function initYouTubeEngine() {
        if (!document.getElementById('yt-iframe-api-script')) {
            const tag = document.createElement('script');
            tag.id = 'yt-iframe-api-script';
            tag.src = "https://www.youtube.com/iframe_api";
            document.head.appendChild(tag);
        }

        const prevReady = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
            if (prevReady) prevReady();
            createYTPlayerInstance();
        };

        if (window.YT && window.YT.Player) {
            createYTPlayerInstance();
        }
    }

    function createYTPlayerInstance() {
        if (ytPlayer || !window.YT || !window.YT.Player) return;

        let wrap = document.getElementById('yt-bg-player-wrap');
        if (!wrap) {
            wrap = document.createElement('div');
            wrap.id = 'yt-bg-player-wrap';
            // In-viewport 1x1 bottom-left pixel, opacity 0.01, pointer-events none
            // In-viewport positioning prevents mobile Chrome/Android from freezing background playback
            wrap.style.cssText = 'position:fixed;bottom:0;left:0;width:1px;height:1px;opacity:0.01;pointer-events:none;z-index:-999;overflow:hidden;';
            const inner = document.createElement('div');
            inner.id = 'yt-bg-player';
            wrap.appendChild(inner);
            document.body.appendChild(wrap);
        }

        try {
            ytPlayer = new window.YT.Player('yt-bg-player', {
                height: '100',
                width: '100',
                videoId: '',
                playerVars: {
                    autoplay: 1,
                    controls: 0,
                    disablekb: 1,
                    fs: 0,
                    playsinline: 1,
                    enablejsapi: 1,
                    origin: window.location.origin
                },
                events: {
                    onReady: (event) => {
                        ytReady = true;
                        try {
                            event.target.unMute();
                            event.target.setVolume(80);
                        } catch (e) {}

                        if (pendingYTAction) {
                            try {
                                event.target.loadVideoById({
                                    videoId: pendingYTAction.videoId,
                                    startSeconds: pendingYTAction.startSeconds || 0
                                });
                                if (pendingYTAction.autoPlay) {
                                    event.target.playVideo();
                                    isPlaying = true;
                                    sessionStorage.setItem('lxvoid_lofi_playing', '1');
                                    sessionStorage.setItem('lxvoid_lofi_playing_intent', '1');
                                    updatePlayerUI(true);
                                    clearResumeHint();
                                }
                            } catch (err) {
                                console.warn('YT onReady action error:', err);
                            }
                            pendingYTAction = null;
                        } else {
                            const cur = activePlaylist[currentTrackIndex];
                            if (cur && cur.type === 'youtube') {
                                const shouldPlay = sessionStorage.getItem('lxvoid_lofi_playing') === '1' || sessionStorage.getItem('lxvoid_lofi_playing_intent') === '1';
                                const savedTime = parseFloat(sessionStorage.getItem('lxvoid_lofi_time') || '0');
                                event.target.loadVideoById({
                                    videoId: cur.youtubeId,
                                    startSeconds: savedTime || 0
                                });
                                if (shouldPlay) {
                                    event.target.playVideo();
                                    isPlaying = true;
                                    sessionStorage.setItem('lxvoid_lofi_playing', '1');
                                    sessionStorage.setItem('lxvoid_lofi_playing_intent', '1');
                                    updatePlayerUI(true);
                                    clearResumeHint();
                                }
                            }
                        }
                    },
                    onStateChange: (e) => {
                        if (e.data === window.YT.PlayerState.PLAYING) {
                            isPlaying = true;
                            sessionStorage.setItem('lxvoid_lofi_playing', '1');
                            sessionStorage.setItem('lxvoid_lofi_playing_intent', '1');
                            updatePlayerUI(true);
                            clearResumeHint();
                        } else if (e.data === window.YT.PlayerState.PAUSED) {
                            // Only set false if not navigating to another page
                            if (sessionStorage.getItem('lxvoid_lofi_navigating') !== '1') {
                                isPlaying = false;
                                sessionStorage.setItem('lxvoid_lofi_playing', '0');
                                updatePlayerUI(false);
                            }
                        } else if (e.data === window.YT.PlayerState.ENDED) {
                            nextTrack(true);
                        }
                    },
                    onError: (e) => {
                        console.warn('YouTube engine error:', e.data);
                        if (e.data === 150 || e.data === 101) {
                            nextTrack(true);
                        }
                    }
                }
            });
        } catch (err) {
            console.debug('YT Player init:', err);
        }
    }

    // Fetch and reassemble chunked audio uploaded by Owner, with Cache Storage persistence
    async function getUploadedBlobUrl(track) {
        if (blobCache[track.id]) {
            return blobCache[track.id];
        }

        // Try local Cache Storage first (instant retrieval across page transitions!)
        if ('caches' in window) {
            try {
                const cache = await caches.open('lxvoid-audio-v1');
                const matched = await cache.match(`/lxvoid-audio/${track.id}`);
                if (matched) {
                    const blob = await matched.blob();
                    const blobUrl = URL.createObjectURL(blob);
                    blobCache[track.id] = blobUrl;
                    return blobUrl;
                }
            } catch (cacheErr) {
                console.debug('CacheStorage check:', cacheErr);
            }
        }

        // Fetch from Firestore REST API chunks if not in cache
        const projectId = 'ff-ft-1c86d';
        const chunks = [];
        const numChunks = track.numChunks || 1;

        for (let i = 0; i < numChunks; i++) {
            const chunkUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/custom_music_chunks/${track.id}_${i}`;
            const res = await fetch(chunkUrl);
            if (!res.ok) throw new Error(`Gagal memuat chunk ${i}`);
            const data = await res.json();
            const chunkBase64 = data.fields?.data?.stringValue || '';
            chunks.push(chunkBase64);
        }

        const fullBase64 = chunks.join('');
        const binary = atob(fullBase64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary.charCodeAt(i);
        }

        const blob = new Blob([bytes], { type: track.mimeType || 'audio/mpeg' });
        const blobUrl = URL.createObjectURL(blob);
        blobCache[track.id] = blobUrl;

        // Persist to Cache Storage for instant retrieval on next pages
        if ('caches' in window) {
            try {
                const cache = await caches.open('lxvoid-audio-v1');
                await cache.put(`/lxvoid-audio/${track.id}`, new Response(blob, {
                    headers: { 'Content-Type': track.mimeType || 'audio/mpeg' }
                }));
            } catch (e) {}
        }

        return blobUrl;
    }

    async function initMusicPlayer() {
        // 1. Instantly read custom songs from localStorage cache (0ms delay for seamless user gesture)
        let cachedSongs = [];
        try {
            const raw = localStorage.getItem('lxvoid_cached_custom_music');
            if (raw) cachedSongs = JSON.parse(raw);
        } catch (e) {}

        if (Array.isArray(cachedSongs) && cachedSongs.length > 0) {
            activePlaylist = [...cachedSongs, ...DEFAULT_PLAYLIST];
        } else {
            activePlaylist = [...DEFAULT_PLAYLIST];
        }

        // Background update of custom music without blocking playback start
        fetchCustomMusic().then(freshSongs => {
            if (Array.isArray(freshSongs) && freshSongs.length >= 0) {
                try {
                    localStorage.setItem('lxvoid_cached_custom_music', JSON.stringify(freshSongs));
                } catch (e) {}
                const cur = activePlaylist[currentTrackIndex];
                activePlaylist = [...freshSongs, ...DEFAULT_PLAYLIST];
                if (cur) {
                    const newIdx = activePlaylist.findIndex(t => (t.id && t.id === cur.id) || (t.title === cur.title));
                    if (newIdx !== -1) {
                        currentTrackIndex = newIdx;
                        sessionStorage.setItem('lxvoid_lofi_track_idx', currentTrackIndex.toString());
                    }
                }
            }
        }).catch(err => console.debug('Background custom music refresh:', err));

        const wasNavigating = sessionStorage.getItem('lxvoid_lofi_navigating') === '1';
        const hasSession = sessionStorage.getItem('lxvoid_lofi_session') === '1';
        const savedTrackId = sessionStorage.getItem('lxvoid_lofi_track_id');
        const savedTrackTitle = sessionStorage.getItem('lxvoid_lofi_track_title');
        const savedTrackIdxStr = sessionStorage.getItem('lxvoid_lofi_track_idx');

        if (!hasSession || !wasNavigating || (savedTrackId === null && savedTrackIdxStr === null)) {
            // Fresh visit to website: Pick a RANDOM song from playlist
            currentTrackIndex = Math.floor(Math.random() * activePlaylist.length);
            sessionStorage.setItem('lxvoid_lofi_track_idx', currentTrackIndex.toString());
            sessionStorage.setItem('lxvoid_lofi_session', '1');
        } else {
            // Internal page transition: match exact track by ID or Title or index
            let foundIdx = -1;
            if (savedTrackId) {
                foundIdx = activePlaylist.findIndex(t => t.id && t.id === savedTrackId);
            }
            if (foundIdx === -1 && savedTrackTitle) {
                foundIdx = activePlaylist.findIndex(t => t.title && t.title === savedTrackTitle);
            }
            if (foundIdx !== -1) {
                currentTrackIndex = foundIdx;
            } else {
                const parsed = parseInt(savedTrackIdxStr, 10);
                currentTrackIndex = (!isNaN(parsed) && parsed >= 0 && parsed < activePlaylist.length) ? parsed : 0;
            }
        }

        sessionStorage.removeItem('lxvoid_lofi_navigating');

        // Create HTML5 Audio instance
        audio = new Audio();
        audio.preload = 'auto';
        audio.volume = 0.65;

        // Sync playback time to sessionStorage
        audio.addEventListener('timeupdate', () => {
            if (!saveTimeThrottle) {
                saveTimeThrottle = setTimeout(() => {
                    saveTimeThrottle = null;
                    if (audio && !audio.paused) {
                        sessionStorage.setItem('lxvoid_lofi_time', audio.currentTime.toString());
                    }
                }, 400);
            }
        });

        audio.addEventListener('ended', () => {
            nextTrack(true);
        });

        // Initialize YouTube Engine in background
        initYouTubeEngine();

        // Create UI
        createMusicPlayerUI();

        // Restore playback position if navigating from another page
        const savedPlaying = sessionStorage.getItem('lxvoid_lofi_playing') === '1' || sessionStorage.getItem('lxvoid_lofi_playing_intent') === '1';
        const savedTime = parseFloat(sessionStorage.getItem('lxvoid_lofi_time') || '0');
        const navTime = parseInt(sessionStorage.getItem('lxvoid_lofi_nav_time') || '0', 10);
        const elapsed = navTime ? Math.max(0, (Date.now() - navTime) / 1000) : 0;

        await loadTrack(currentTrackIndex, savedPlaying ? (savedTime + Math.min(elapsed, 1.2)) : 0);

        if (savedPlaying) {
            attemptPlay();
        }

        setupLinkPersistence();
        setupLinkPrefetch();
    }

    function createMusicPlayerUI() {
        if (document.getElementById('floating-music-player')) return;

        const player = document.createElement('div');
        player.className = 'floating-music-player';
        player.id = 'floating-music-player';
        player.title = 'Putar Musik LXVOID';

        // Check if user previously minimized the player
        const isMinimized = localStorage.getItem('lxvoid_lofi_minimized') === '1';
        if (isMinimized) {
            player.classList.add('is-mini');
        }

        const track = activePlaylist[currentTrackIndex] || activePlaylist[0];

        player.innerHTML = `
            <div class="music-mini-icon" id="music-mini-icon" title="Ketuk untuk perbesar pemutar musik">🎵</div>
            <div class="music-btn-group">
                <button type="button" class="music-play-btn" id="music-toggle-btn" aria-label="Play/Pause BGM" title="Putar / Jeda Musik">▶</button>
                <button type="button" class="music-next-btn" id="music-next-btn" aria-label="Lagu Selanjutnya" title="Ganti Lagu Selanjutnya">⏭</button>
            </div>
            <div class="music-meta" id="music-meta-info" title="Klik untuk putar/jeda">
                <span class="music-title" id="music-title-text">${escapeHtml(track.title)}</span>
                <span class="music-sub">
                    <span id="music-artist-text">${escapeHtml(track.artist)}</span>
                    <div class="music-bars"><span></span><span></span><span></span></div>
                </span>
            </div>
            <button type="button" class="music-minimize-btn" id="music-minimize-btn" title="Kecilkan pemutar musik" aria-label="Kecilkan">✕</button>
        `;

        document.body.appendChild(player);

        const playBtn = player.querySelector('#music-toggle-btn');
        const nextBtn = player.querySelector('#music-next-btn');
        const metaInfo = player.querySelector('#music-meta-info');
        const minBtn = player.querySelector('#music-minimize-btn');

        playBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMusic();
        });

        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            nextTrack(true);
        });

        metaInfo.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMusic();
        });

        minBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            player.classList.add('is-mini');
            localStorage.setItem('lxvoid_lofi_minimized', '1');
        });

        player.addEventListener('click', () => {
            if (player.classList.contains('is-mini')) {
                player.classList.remove('is-mini');
                localStorage.setItem('lxvoid_lofi_minimized', '0');
            }
        });
    }

    function setAudioStartTime(audioEl, startTime) {
        if (!startTime || startTime <= 0) return;
        if (audioEl.readyState >= 1) {
            try { audioEl.currentTime = startTime; } catch (e) {}
        } else {
            const onMeta = () => {
                try { audioEl.currentTime = startTime; } catch (e) {}
                audioEl.removeEventListener('loadedmetadata', onMeta);
            };
            audioEl.addEventListener('loadedmetadata', onMeta, { once: true });
        }
    }

    async function loadTrack(index, startTime = 0) {
        currentTrackIndex = (index + activePlaylist.length) % activePlaylist.length;
        sessionStorage.setItem('lxvoid_lofi_track_idx', currentTrackIndex.toString());

        const track = activePlaylist[currentTrackIndex];
        if (!track) return;

        sessionStorage.setItem('lxvoid_lofi_track_id', track.id || '');
        sessionStorage.setItem('lxvoid_lofi_track_type', track.type || 'direct');
        sessionStorage.setItem('lxvoid_lofi_track_title', track.title || '');
        sessionStorage.setItem('lxvoid_lofi_track_src', track.src || '');
        sessionStorage.setItem('lxvoid_lofi_track_ytid', track.youtubeId || '');

        updatePlayerUI(isPlaying);

        if (track.type === 'youtube') {
            // Stop HTML5 audio
            if (audio) {
                audio.pause();
                audio.src = '';
            }

            if (ytPlayer && ytReady && ytPlayer.loadVideoById) {
                try {
                    ytPlayer.unMute();
                    ytPlayer.setVolume(80);
                    ytPlayer.loadVideoById({
                        videoId: track.youtubeId,
                        startSeconds: startTime || 0
                    });
                    if (isPlaying) {
                        ytPlayer.playVideo();
                    } else {
                        ytPlayer.pauseVideo();
                    }
                } catch (e) {
                    console.warn('YT loadVideoById error:', e);
                }
            } else {
                // Queue pending action for when YouTube onReady fires
                pendingYTAction = {
                    videoId: track.youtubeId,
                    startSeconds: startTime || 0,
                    autoPlay: isPlaying || (sessionStorage.getItem('lxvoid_lofi_playing_intent') === '1')
                };
            }
        } else if (track.type === 'uploaded') {
            // Stop YouTube player
            if (ytPlayer && ytReady && ytPlayer.stopVideo) {
                try { ytPlayer.stopVideo(); } catch (e) {}
            }
            pendingYTAction = null;

            try {
                const blobUrl = await getUploadedBlobUrl(track);
                if (audio) {
                    audio.src = blobUrl;
                    setAudioStartTime(audio, startTime);
                }
            } catch (err) {
                console.warn('Gagal memuat uploaded track, lanjut track berikutnya:', err);
                nextTrack(isPlaying);
            }
        } else {
            // Direct audio stream / Default Lo-Fi
            if (ytPlayer && ytReady && ytPlayer.stopVideo) {
                try { ytPlayer.stopVideo(); } catch (e) {}
            }
            pendingYTAction = null;

            if (audio) {
                audio.src = track.src || track.url;
                setAudioStartTime(audio, startTime);
            }
        }

        updatePlayerUI(isPlaying);
    }

    function toggleMusic() {
        if (isPlaying) {
            pauseMusic();
        } else {
            playMusic();
        }
    }

    function playMusic() {
        attemptPlay();
    }

    function attemptPlay() {
        const track = activePlaylist[currentTrackIndex];
        if (!track) return;

        sessionStorage.setItem('lxvoid_lofi_playing_intent', '1');

        if (track.type === 'youtube') {
            if (ytPlayer && ytReady && ytPlayer.playVideo) {
                try {
                    ytPlayer.unMute();
                    ytPlayer.setVolume(80);
                    ytPlayer.playVideo();
                    isPlaying = true;
                    sessionStorage.setItem('lxvoid_lofi_playing', '1');
                    sessionStorage.setItem('lxvoid_lofi_playing_intent', '1');
                    updatePlayerUI(true);
                    clearResumeHint();
                } catch (e) {
                    console.warn("YT play error:", e);
                    showResumeHint();
                }
            } else {
                isPlaying = true;
                sessionStorage.setItem('lxvoid_lofi_playing', '1');
                sessionStorage.setItem('lxvoid_lofi_playing_intent', '1');
                updatePlayerUI(true);
                if (pendingYTAction) {
                    pendingYTAction.autoPlay = true;
                } else {
                    pendingYTAction = {
                        videoId: track.youtubeId,
                        startSeconds: parseFloat(sessionStorage.getItem('lxvoid_lofi_time') || '0'),
                        autoPlay: true
                    };
                }
            }
        } else {
            if (!audio) return;
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    isPlaying = true;
                    sessionStorage.setItem('lxvoid_lofi_playing', '1');
                    sessionStorage.setItem('lxvoid_lofi_playing_intent', '1');
                    updatePlayerUI(true);
                    clearResumeHint();
                }).catch((err) => {
                    console.warn('Audio play blocked by browser autoplay:', err);
                    isPlaying = false;
                    // Do NOT reset lxvoid_lofi_playing_intent so the user's next tap resumes immediately!
                    updatePlayerUI(false);
                    showResumeHint();
                });
            }
        }
    }

    function pauseMusic() {
        const track = activePlaylist[currentTrackIndex];
        if (track && track.type === 'youtube') {
            if (ytPlayer && ytReady && ytPlayer.pauseVideo) {
                try { ytPlayer.pauseVideo(); } catch (e) {}
            }
            if (pendingYTAction) pendingYTAction.autoPlay = false;
        } else {
            if (audio) {
                audio.pause();
                sessionStorage.setItem('lxvoid_lofi_time', audio.currentTime.toString());
            }
        }

        isPlaying = false;
        sessionStorage.setItem('lxvoid_lofi_playing', '0');
        sessionStorage.setItem('lxvoid_lofi_playing_intent', '0');
        updatePlayerUI(false);
        clearResumeHint();
    }

    async function nextTrack(autoPlay = true) {
        currentTrackIndex = (currentTrackIndex + 1) % activePlaylist.length;
        sessionStorage.setItem('lxvoid_lofi_track_idx', currentTrackIndex.toString());
        sessionStorage.setItem('lxvoid_lofi_time', '0');

        await loadTrack(currentTrackIndex, 0);

        if (autoPlay || isPlaying) {
            playMusic();
        }
    }

    function updatePlayerUI(playing) {
        const player = document.getElementById('floating-music-player');
        const playBtn = document.getElementById('music-toggle-btn');
        const titleEl = document.getElementById('music-title-text');
        const artistEl = document.getElementById('music-artist-text');

        const track = activePlaylist[currentTrackIndex];
        if (!track) return;

        if (titleEl) titleEl.innerText = track.title;
        if (artistEl) artistEl.innerText = track.artist;

        if (player) {
            if (playing) {
                player.classList.add('playing');
            } else {
                player.classList.remove('playing');
            }
        }

        if (playBtn) {
            playBtn.innerText = playing ? '⏸' : '▶';
            playBtn.title = playing ? 'Jeda Musik' : 'Putar Musik';
        }
    }

    let resumeListenerAttached = false;
    function showResumeHint() {
        const player = document.getElementById('floating-music-player');
        if (player) player.classList.add('pulse-hint');

        if (!resumeListenerAttached) {
            resumeListenerAttached = true;
            const onFirstGesture = () => {
                resumeListenerAttached = false;
                clearResumeHint();
                if (sessionStorage.getItem('lxvoid_lofi_playing_intent') === '1') {
                    attemptPlay();
                }
                window.removeEventListener('click', onFirstGesture, true);
                window.removeEventListener('touchstart', onFirstGesture, true);
                window.removeEventListener('keydown', onFirstGesture, true);
            };

            window.addEventListener('click', onFirstGesture, true);
            window.addEventListener('touchstart', onFirstGesture, true);
            window.addEventListener('keydown', onFirstGesture, true);
        }
    }

    function clearResumeHint() {
        const player = document.getElementById('floating-music-player');
        if (player) player.classList.remove('pulse-hint');
    }

    function setupLinkPersistence() {
        document.addEventListener('click', (e) => {
            const anchor = e.target.closest('a');
            if (!anchor) return;
            const href = anchor.getAttribute('href');
            if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return;
            if (anchor.target === '_blank') return;

            try {
                const targetUrl = new URL(href, window.location.href);
                if (targetUrl.origin === window.location.origin) {
                    const track = activePlaylist[currentTrackIndex];
                    let curTime = 0;
                    if (track && track.type === 'youtube') {
                        if (ytPlayer && ytReady && ytPlayer.getCurrentTime) {
                            try { curTime = ytPlayer.getCurrentTime() || 0; } catch (e) {}
                        }
                    } else if (audio) {
                        curTime = audio.currentTime || 0;
                    }

                    if (track) {
                        sessionStorage.setItem('lxvoid_lofi_track_id', track.id || '');
                        sessionStorage.setItem('lxvoid_lofi_track_title', track.title || '');
                        sessionStorage.setItem('lxvoid_lofi_track_type', track.type || '');
                        sessionStorage.setItem('lxvoid_lofi_track_ytid', track.youtubeId || '');
                        sessionStorage.setItem('lxvoid_lofi_track_src', track.src || '');
                    }
                    sessionStorage.setItem('lxvoid_lofi_playing', isPlaying ? '1' : '0');
                    sessionStorage.setItem('lxvoid_lofi_playing_intent', isPlaying ? '1' : '0');
                    sessionStorage.setItem('lxvoid_lofi_time', curTime.toString());
                    sessionStorage.setItem('lxvoid_lofi_track_idx', currentTrackIndex.toString());
                    sessionStorage.setItem('lxvoid_lofi_nav_time', Date.now().toString());
                    sessionStorage.setItem('lxvoid_lofi_navigating', '1');
                }
            } catch (err) {}
        }, { capture: true });

        window.addEventListener('beforeunload', () => {
            const track = activePlaylist[currentTrackIndex];
            let curTime = 0;
            if (track && track.type === 'youtube') {
                if (ytPlayer && ytReady && ytPlayer.getCurrentTime) {
                    try { curTime = ytPlayer.getCurrentTime() || 0; } catch (e) {}
                }
            } else if (audio) {
                curTime = audio.currentTime || 0;
            }

            if (curTime > 0) {
                sessionStorage.setItem('lxvoid_lofi_time', curTime.toString());
            }
            if (track) {
                sessionStorage.setItem('lxvoid_lofi_track_id', track.id || '');
                sessionStorage.setItem('lxvoid_lofi_track_title', track.title || '');
                sessionStorage.setItem('lxvoid_lofi_track_type', track.type || '');
                sessionStorage.setItem('lxvoid_lofi_track_ytid', track.youtubeId || '');
                sessionStorage.setItem('lxvoid_lofi_track_src', track.src || '');
            }
            sessionStorage.setItem('lxvoid_lofi_track_idx', currentTrackIndex.toString());
            sessionStorage.setItem('lxvoid_lofi_nav_time', Date.now().toString());
        });
    }

    function setupLinkPrefetch() {
        const prefetched = new Set();
        function prefetch(url) {
            if (prefetched.has(url)) return;
            prefetched.add(url);
            const link = document.createElement('link');
            link.rel = 'prefetch';
            link.href = url;
            document.head.appendChild(link);
        }

        document.addEventListener('mouseover', (e) => {
            const a = e.target.closest('a');
            if (!a) return;
            const href = a.getAttribute('href');
            if (href && !href.startsWith('#') && !href.startsWith('http') && a.target !== '_blank') {
                prefetch(href);
            }
        }, { passive: true });
    }

    // ================= 3. MODERN REFERENCE HEADER SCROLL BEHAVIOR =================
    function initHeaderScroll() {
        const header = document.querySelector('.modern-reference-header') || document.querySelector('.cyber-reference-header');
        if (!header) return;

        const holder = document.querySelector('.site-header-holder');
        let isScrolled = false;

        const updateHeader = () => {
            const scrollY = window.scrollY || window.pageYOffset;
            const triggerPoint = holder ? Math.max(25, (holder.offsetTop || 0) + 10) : 25;

            if (scrollY > triggerPoint) {
                if (!isScrolled) {
                    isScrolled = true;
                    header.classList.add('header-scrolled');
                }
            } else {
                if (isScrolled) {
                    isScrolled = false;
                    header.classList.remove('header-scrolled');
                }
            }
        };

        window.addEventListener('scroll', updateHeader, { passive: true });
        updateHeader();
    }

    // ================= INITIALIZATION =================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initAnnouncement();
            initMusicPlayer();
            initHeaderScroll();
        });
    } else {
        initAnnouncement();
        initMusicPlayer();
        initHeaderScroll();
    }
})();
