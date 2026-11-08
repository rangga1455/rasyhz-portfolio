/**
 * site-features.js - LXVOID COMMUNITY Shared Features
 * 1. Global Announcement Ticker (from Firestore site_settings/announcement)
 * 2. Mini Floating Lo-Fi Music Player (Web Audio API Synthesizer)
 */

(function () {
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

    // ================= 2. MINI FLOATING MUSIC PLAYER =================
    let audioCtx = null;
    let isPlaying = false;
    let musicInterval = null;
    let currentStep = 0;

    // Chord progression in Hz (Lo-Fi Chill chords: Dm9 -> G13 -> Cmaj9 -> A7b13)
    const chords = [
        [146.83, 220.00, 261.63, 329.63], // Dm9
        [196.00, 246.94, 329.63, 392.00], // G13
        [130.81, 196.00, 246.94, 329.63], // Cmaj9
        [220.00, 277.18, 329.63, 415.30]  // A7b13
    ];

    function createMusicPlayerUI() {
        const player = document.createElement('div');
        player.className = 'floating-music-player';
        player.id = 'floating-music-player';
        player.title = 'Putar Musik Santai LXVOID Lo-Fi';

        player.innerHTML = `
            <button type="button" class="music-play-btn" id="music-toggle-btn" aria-label="Play/Pause BGM">▶</button>
            <div class="music-meta">
                <span class="music-title">LXVOID Chill Beat</span>
                <span class="music-sub">
                    Lo-Fi AMV BGM
                    <div class="music-bars"><span></span><span></span><span></span></div>
                </span>
            </div>
        `;

        player.addEventListener('click', toggleMusic);
        document.body.appendChild(player);
    }

    function toggleMusic(e) {
        if (e) e.stopPropagation();
        if (isPlaying) {
            pauseMusic();
        } else {
            playMusic();
        }
    }

    function playMusic() {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;

        if (!audioCtx) {
            audioCtx = new AudioContext();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        isPlaying = true;
        const player = document.getElementById('floating-music-player');
        if (player) {
            player.classList.add('playing');
            const btn = document.getElementById('music-toggle-btn');
            if (btn) btn.innerText = '⏸';
        }

        // Loop chords and soft beat every 1.8 seconds per chord
        currentStep = 0;
        playChordStep();
        musicInterval = setInterval(playChordStep, 1800);
    }

    function pauseMusic() {
        isPlaying = false;
        if (musicInterval) {
            clearInterval(musicInterval);
            musicInterval = null;
        }
        if (audioCtx && audioCtx.state === 'running') {
            audioCtx.suspend();
        }
        const player = document.getElementById('floating-music-player');
        if (player) {
            player.classList.remove('playing');
            const btn = document.getElementById('music-toggle-btn');
            if (btn) btn.innerText = '▶';
        }
    }

    function playChordStep() {
        if (!audioCtx || audioCtx.state !== 'running') return;
        const now = audioCtx.currentTime;
        const chord = chords[currentStep % chords.length];
        currentStep++;

        // 1. Play soft warm polyphonic chord
        chord.forEach((freq, idx) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            const filter = audioCtx.createBiquadFilter();

            osc.type = idx === 0 ? 'triangle' : 'sine';
            osc.frequency.setValueAtTime(freq, now);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(800, now);

            gain.gain.setValueAtTime(0.001, now);
            gain.gain.linearRampToValueAtTime(0.045, now + 0.15);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 1.7);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(audioCtx.destination);

            osc.start(now);
            osc.stop(now + 1.75);
        });

        // 2. Play soft lo-fi kick / beat
        const kickOsc = audioCtx.createOscillator();
        const kickGain = audioCtx.createGain();
        kickOsc.type = 'sine';
        kickOsc.frequency.setValueAtTime(95, now);
        kickOsc.frequency.exponentialRampToValueAtTime(35, now + 0.2);

        kickGain.gain.setValueAtTime(0.12, now);
        kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        kickOsc.connect(kickGain);
        kickGain.connect(audioCtx.destination);
        kickOsc.start(now);
        kickOsc.stop(now + 0.28);
    }

    document.addEventListener('DOMContentLoaded', () => {
        initAnnouncement();
        createMusicPlayerUI();
    });
})();
