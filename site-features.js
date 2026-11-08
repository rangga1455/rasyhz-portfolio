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
    let isPlaying = false;
    let currentTrackIndex = 0;
    let saveTimeThrottle = null;
    const blobCache = {}; // Cache for reassembled uploaded audio blobs

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
            wrap.style.cssText = 'position:fixed;bottom:-9999px;right:-9999px;width:200px;height:200px;opacity:0.001;pointer-events:none;z-index:-1;';
            const inner = document.createElement('div');
            inner.id = 'yt-bg-player';
            wrap.appendChild(inner);
            document.body.appendChild(wrap);
        }

        try {
            ytPlayer = new window.YT.Player('yt-bg-player', {
                height: '200',
                width: '200',
                videoId: '',
                playerVars: {
                    autoplay: 0,
                    controls: 0,
                    disablekb: 1,
                    fs: 0,
                    playsinline: 1,
                    modestbranding: 1
                },
                events: {
                    onReady: () => {
                        ytReady = true;
                    },
                    onStateChange: (e) => {
                        if (e.data === window.YT.PlayerState.PLAYING) {
                            isPlaying = true;
                            updatePlayerUI(true);
                        } else if (e.data === window.YT.PlayerState.PAUSED) {
                            isPlaying = false;
                            updatePlayerUI(false);
                        } else if (e.data === window.YT.PlayerState.ENDED) {
                            nextTrack(true);
                        }
                    }
                }
            });
        } catch (err) {
            console.debug('YT Player init:', err);
        }
    }

    // Fetch and reassemble chunked audio uploaded by Owner
    async function getUploadedBlobUrl(track) {
        if (blobCache[track.id]) {
            return blobCache[track.id];
        }

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
        return blobUrl;
    }

    async function initMusicPlayer() {
        // Load custom music from Firestore and merge with defaults
        const customSongs = await fetchCustomMusic();
        if (customSongs.length > 0) {
            // Prioritize custom music added by owner, followed by curated Lo-Fi
            activePlaylist = [...customSongs, ...DEFAULT_PLAYLIST];
        } else {
            activePlaylist = [...DEFAULT_PLAYLIST];
        }

        const wasNavigating = sessionStorage.getItem('lxvoid_lofi_navigating') === '1';
        const hasSession = sessionStorage.getItem('lxvoid_lofi_session') === '1';
        const savedTrackStr = sessionStorage.getItem('lxvoid_lofi_track_idx');

        if (!hasSession || !wasNavigating || savedTrackStr === null) {
            // Fresh visit to the website! Pick a RANDOM song from playlist
            currentTrackIndex = Math.floor(Math.random() * activePlaylist.length);
            sessionStorage.setItem('lxvoid_lofi_track_idx', currentTrackIndex.toString());
            sessionStorage.setItem('lxvoid_lofi_session', '1');
        } else {
            // Internal page transition: keep current track
            const parsed = parseInt(savedTrackStr, 10);
            currentTrackIndex = (!isNaN(parsed) && parsed >= 0 && parsed < activePlaylist.length) ? parsed : 0;
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
        const savedPlaying = sessionStorage.getItem('lxvoid_lofi_playing') === '1';
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

    async function loadTrack(index, startTime = 0) {
        currentTrackIndex = (index + activePlaylist.length) % activePlaylist.length;
        sessionStorage.setItem('lxvoid_lofi_track_idx', currentTrackIndex.toString());

        const track = activePlaylist[currentTrackIndex];
        updatePlayerUI(isPlaying);

        if (track.type === 'youtube') {
            // Stop HTML5 audio
            if (audio) {
                audio.pause();
                audio.src = '';
            }

            if (ytPlayer && ytPlayer.loadVideoById) {
                ytPlayer.loadVideoById({
                    videoId: track.youtubeId,
                    startSeconds: startTime || 0
                });
                if (!isPlaying) {
                    ytPlayer.pauseVideo();
                }
            }
        } else if (track.type === 'uploaded') {
            // Stop YouTube player
            if (ytPlayer && ytPlayer.stopVideo) {
                try { ytPlayer.stopVideo(); } catch (e) {}
            }

            try {
                const blobUrl = await getUploadedBlobUrl(track);
                if (audio) {
                    audio.src = blobUrl;
                    if (startTime > 0) {
                        audio.currentTime = startTime;
                    }
                }
            } catch (err) {
                console.warn('Gagal memuat uploaded track, lanjut track berikutnya:', err);
                nextTrack(isPlaying);
            }
        } else {
            // Direct audio stream / Default Lo-Fi
            if (ytPlayer && ytPlayer.stopVideo) {
                try { ytPlayer.stopVideo(); } catch (e) {}
            }

            if (audio) {
                audio.src = track.src || track.url;
                if (startTime > 0) {
                    audio.currentTime = startTime;
                }
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

        if (track.type === 'youtube') {
            if (ytPlayer && ytPlayer.playVideo) {
                ytPlayer.playVideo();
                isPlaying = true;
                sessionStorage.setItem('lxvoid_lofi_playing', '1');
                updatePlayerUI(true);
                clearResumeHint();
            } else {
                // If YT not ready yet, wait for ready
                showResumeHint();
            }
        } else {
            if (!audio) return;
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    isPlaying = true;
                    sessionStorage.setItem('lxvoid_lofi_playing', '1');
                    updatePlayerUI(true);
                    clearResumeHint();
                }).catch((err) => {
                    console.warn('Audio play waiting for interaction:', err);
                    isPlaying = false;
                    sessionStorage.setItem('lxvoid_lofi_playing', '0');
                    updatePlayerUI(false);
                    showResumeHint();
                });
            }
        }
    }

    function pauseMusic() {
        const track = activePlaylist[currentTrackIndex];
        if (track && track.type === 'youtube') {
            if (ytPlayer && ytPlayer.pauseVideo) {
                try { ytPlayer.pauseVideo(); } catch (e) {}
            }
        } else {
            if (audio) {
                audio.pause();
                sessionStorage.setItem('lxvoid_lofi_time', audio.currentTime.toString());
            }
        }

        isPlaying = false;
        sessionStorage.setItem('lxvoid_lofi_playing', '0');
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
                if (sessionStorage.getItem('lxvoid_lofi_playing_intent') !== '0') {
                    attemptPlay();
                }
                window.removeEventListener('click', onFirstGesture);
                window.removeEventListener('touchstart', onFirstGesture);
                window.removeEventListener('keydown', onFirstGesture);
            };

            window.addEventListener('click', onFirstGesture, { once: true });
            window.addEventListener('touchstart', onFirstGesture, { once: true });
            window.addEventListener('keydown', onFirstGesture, { once: true });
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
                        if (ytPlayer && ytPlayer.getCurrentTime) {
                            curTime = ytPlayer.getCurrentTime() || 0;
                        }
                    } else if (audio) {
                        curTime = audio.currentTime || 0;
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
                if (ytPlayer && ytPlayer.getCurrentTime) {
                    curTime = ytPlayer.getCurrentTime() || 0;
                }
            } else if (audio) {
                curTime = audio.currentTime || 0;
            }

            sessionStorage.setItem('lxvoid_lofi_playing', isPlaying ? '1' : '0');
            sessionStorage.setItem('lxvoid_lofi_time', curTime.toString());
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

    // ================= INITIALIZATION =================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initAnnouncement();
            initMusicPlayer();
        });
    } else {
        initAnnouncement();
        initMusicPlayer();
    }
})();
