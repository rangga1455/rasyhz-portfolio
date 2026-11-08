/**
 * site-features.js - LXVOID COMMUNITY Shared Features
 * 1. Global Announcement Ticker (from Firestore site_settings/announcement)
 * 2. Trending Lo-Fi Music Player with Cross-Page Continuous Playback & Random Track on Visit
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

    // ================= 2. TRENDING LO-FI PLAYLIST & PERSISTENT BGM =================
    const LOFI_PLAYLIST = [
        {
            title: "Death Bed (Coffee)",
            artist: "Powfu / Beabadoobee",
            src: "https://cdn.jsdelivr.net/gh/pramit-marattha/lofi-music-player-vanilla-javascript@master/sounds/songs/Death%20Bed.mp3"
        },
        {
            title: "I'm Closing My Eyes",
            artist: "potsu ft. Shiloh Dynasty",
            src: "https://cdn.jsdelivr.net/gh/pramit-marattha/lofi-music-player-vanilla-javascript@master/sounds/songs/i%27m%20closing%20my%20eyes%20(feat.%20shiloh).mp3"
        },
        {
            title: "Can We Kiss Forever?",
            artist: "Kina ft. Adriana Proenza",
            src: "https://cdn.jsdelivr.net/gh/pramit-marattha/lofi-music-player-vanilla-javascript@master/sounds/songs/Can%20We%20Kiss%20Forever%20.mp3"
        },
        {
            title: "5:32 PM (Chill Beats)",
            artist: "The Deli",
            src: "https://cdn.jsdelivr.net/gh/pramit-marattha/lofi-music-player-vanilla-javascript@master/sounds/songs/5%2032pm.mp3"
        },
        {
            title: "Affection",
            artist: "Jinsang",
            src: "https://cdn.jsdelivr.net/gh/pramit-marattha/lofi-music-player-vanilla-javascript@master/sounds/songs/Affection.mp3"
        },
        {
            title: "Controlla (Lo-Fi)",
            artist: "Idealism",
            src: "https://cdn.jsdelivr.net/gh/pramit-marattha/lofi-music-player-vanilla-javascript@master/sounds/songs/controlla.mp3"
        },
        {
            title: "Coffee Breath",
            artist: "Sofia Mills Lofi",
            src: "https://cdn.jsdelivr.net/gh/pramit-marattha/lofi-music-player-vanilla-javascript@master/sounds/songs/Coffee%20Breath.mp3"
        },
        {
            title: "My New Love",
            artist: "Elijah Who",
            src: "https://cdn.jsdelivr.net/gh/pramit-marattha/lofi-music-player-vanilla-javascript@master/sounds/songs/my%20new%20love.mp3"
        },
        {
            title: "Walk But in a Garden",
            artist: "LLusion",
            src: "https://cdn.jsdelivr.net/gh/pramit-marattha/lofi-music-player-vanilla-javascript@master/sounds/songs/walk%20but%20in%20a%20garden.mp3"
        },
        {
            title: "Warm Breeze",
            artist: "Lofi Girl Aesthetic",
            src: "https://cdn.jsdelivr.net/gh/pramit-marattha/lofi-music-player-vanilla-javascript@master/sounds/songs/warm%20breeze.mp3"
        }
    ];

    let audio = null;
    let currentTrackIndex = 0;
    let isPlaying = false;
    let saveTimeThrottle = null;

    function initMusicPlayer() {
        const wasNavigating = sessionStorage.getItem('lxvoid_lofi_navigating') === '1';
        const hasSession = sessionStorage.getItem('lxvoid_lofi_session') === '1';
        const savedTrackStr = sessionStorage.getItem('lxvoid_lofi_track_idx');

        if (!hasSession || !wasNavigating || savedTrackStr === null) {
            // Fresh visit to the website! Pick a RANDOM trending Lo-Fi song
            currentTrackIndex = Math.floor(Math.random() * LOFI_PLAYLIST.length);
            sessionStorage.setItem('lxvoid_lofi_track_idx', currentTrackIndex.toString());
            sessionStorage.setItem('lxvoid_lofi_session', '1');
        } else {
            // Internal page transition: keep current track
            const parsed = parseInt(savedTrackStr, 10);
            currentTrackIndex = (!isNaN(parsed) && parsed >= 0 && parsed < LOFI_PLAYLIST.length) ? parsed : 0;
        }

        // Reset navigating flag
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

        // Track ended -> automatically advance to next song in playlist
        audio.addEventListener('ended', () => {
            nextTrack(true);
        });

        // Create Player UI in DOM
        createMusicPlayerUI();

        // Restore playback position if navigating from another page
        const savedPlaying = sessionStorage.getItem('lxvoid_lofi_playing') === '1';
        const savedTime = parseFloat(sessionStorage.getItem('lxvoid_lofi_time') || '0');
        const navTime = parseInt(sessionStorage.getItem('lxvoid_lofi_nav_time') || '0', 10);
        const elapsed = navTime ? Math.max(0, (Date.now() - navTime) / 1000) : 0;

        loadTrack(currentTrackIndex, savedPlaying ? (savedTime + Math.min(elapsed, 1.2)) : 0);

        if (savedPlaying) {
            attemptPlay();
        }

        // Intercept internal link clicks to record audio position right before navigation
        setupLinkPersistence();

        // Prefetch internal pages on hover for instant cross-page loading
        setupLinkPrefetch();
    }

    function createMusicPlayerUI() {
        if (document.getElementById('floating-music-player')) return;

        const player = document.createElement('div');
        player.className = 'floating-music-player';
        player.id = 'floating-music-player';
        player.title = 'Putar Musik Lo-Fi Trending LXVOID';

        // Check if user previously minimized the player
        const isMinimized = localStorage.getItem('lxvoid_lofi_minimized') === '1';
        if (isMinimized) {
            player.classList.add('is-mini');
        }

        player.innerHTML = `
            <div class="music-mini-icon" id="music-mini-icon" title="Ketuk untuk perbesar pemutar musik">🎵</div>
            <div class="music-btn-group">
                <button type="button" class="music-play-btn" id="music-toggle-btn" aria-label="Play/Pause BGM" title="Putar / Jeda Musik">▶</button>
                <button type="button" class="music-next-btn" id="music-next-btn" aria-label="Lagu Selanjutnya" title="Ganti Lagu Lo-Fi Selanjutnya">⏭</button>
            </div>
            <div class="music-meta" id="music-meta-info" title="Klik untuk putar/jeda">
                <span class="music-title" id="music-title-text">${escapeHtml(LOFI_PLAYLIST[currentTrackIndex].title)}</span>
                <span class="music-sub">
                    <span id="music-artist-text">${escapeHtml(LOFI_PLAYLIST[currentTrackIndex].artist)}</span>
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
        const miniIcon = player.querySelector('#music-mini-icon');

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

    function loadTrack(index, startTime = 0) {
        if (!audio) return;
        currentTrackIndex = (index + LOFI_PLAYLIST.length) % LOFI_PLAYLIST.length;
        sessionStorage.setItem('lxvoid_lofi_track_idx', currentTrackIndex.toString());

        const track = LOFI_PLAYLIST[currentTrackIndex];
        audio.src = track.src;

        if (startTime > 0) {
            audio.currentTime = startTime;
        }

        updatePlayerUI(isPlaying);
    }

    function toggleMusic() {
        if (!audio) return;
        if (isPlaying) {
            pauseMusic();
        } else {
            playMusic();
        }
    }

    function playMusic() {
        if (!audio) return;
        attemptPlay();
    }

    function attemptPlay() {
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

    function pauseMusic() {
        if (!audio) return;
        audio.pause();
        isPlaying = false;
        sessionStorage.setItem('lxvoid_lofi_playing', '0');
        sessionStorage.setItem('lxvoid_lofi_time', audio.currentTime.toString());
        updatePlayerUI(false);
        clearResumeHint();
    }

    function nextTrack(autoPlay = true) {
        currentTrackIndex = (currentTrackIndex + 1) % LOFI_PLAYLIST.length;
        sessionStorage.setItem('lxvoid_lofi_track_idx', currentTrackIndex.toString());
        sessionStorage.setItem('lxvoid_lofi_time', '0');

        loadTrack(currentTrackIndex, 0);

        if (autoPlay || isPlaying) {
            playMusic();
        }
    }

    function updatePlayerUI(playing) {
        const player = document.getElementById('floating-music-player');
        const playBtn = document.getElementById('music-toggle-btn');
        const titleEl = document.getElementById('music-title-text');
        const artistEl = document.getElementById('music-artist-text');

        const track = LOFI_PLAYLIST[currentTrackIndex];
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

    // Gentle pulse hint when browser autoplay policy requires 1 tap/click after page navigation
    let resumeListenerAttached = false;
    function showResumeHint() {
        const player = document.getElementById('floating-music-player');
        if (player) player.classList.add('pulse-hint');

        if (!resumeListenerAttached) {
            resumeListenerAttached = true;
            const onFirstGesture = () => {
                resumeListenerAttached = false;
                clearResumeHint();
                if (audio && sessionStorage.getItem('lxvoid_lofi_playing_intent') !== '0') {
                    audio.play().then(() => {
                        isPlaying = true;
                        sessionStorage.setItem('lxvoid_lofi_playing', '1');
                        updatePlayerUI(true);
                    }).catch(() => {});
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

    // Save audio state right when any internal link is clicked
    function setupLinkPersistence() {
        document.addEventListener('click', (e) => {
            const anchor = e.target.closest('a');
            if (!anchor) return;
            const href = anchor.getAttribute('href');
            if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return;
            if (anchor.target === '_blank') return;

            // Check if internal link
            try {
                const targetUrl = new URL(href, window.location.href);
                if (targetUrl.origin === window.location.origin) {
                    if (audio) {
                        const playingNow = (!audio.paused && !audio.ended && isPlaying);
                        sessionStorage.setItem('lxvoid_lofi_playing', playingNow ? '1' : '0');
                        sessionStorage.setItem('lxvoid_lofi_playing_intent', playingNow ? '1' : '0');
                        sessionStorage.setItem('lxvoid_lofi_time', audio.currentTime.toString());
                        sessionStorage.setItem('lxvoid_lofi_track_idx', currentTrackIndex.toString());
                        sessionStorage.setItem('lxvoid_lofi_nav_time', Date.now().toString());
                        sessionStorage.setItem('lxvoid_lofi_navigating', '1');
                    }
                }
            } catch (err) {
                // Ignore invalid URL
            }
        }, { capture: true });

        window.addEventListener('beforeunload', () => {
            if (audio) {
                const playingNow = (!audio.paused && !audio.ended && isPlaying);
                sessionStorage.setItem('lxvoid_lofi_playing', playingNow ? '1' : '0');
                sessionStorage.setItem('lxvoid_lofi_time', audio.currentTime.toString());
                sessionStorage.setItem('lxvoid_lofi_track_idx', currentTrackIndex.toString());
                sessionStorage.setItem('lxvoid_lofi_nav_time', Date.now().toString());
            }
        });
    }

    // Preload internal pages when user hovers on navbar links (instant navigation)
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
