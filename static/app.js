document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const countryList = document.getElementById('countryList');
    const channelGrid = document.getElementById('channelGrid');
    const selectedCountryTitle = document.getElementById('selectedCountryTitle');
    const countrySearch = document.getElementById('countrySearch');
    const globalSearch = document.getElementById('globalSearch');
    const channelSearch = document.getElementById('channelSearch');
    const categoryFilters = document.getElementById('categoryFilters');
    
    // Player Elements
    const playerModal = document.getElementById('playerModal');
    const playerContent = document.getElementById('playerContent');
    const videoContainer = document.getElementById('videoContainer');
    const closePlayerBtn = document.getElementById('closePlayerBtn');
    const videoPlayer = document.getElementById('videoPlayer');
    const nowPlayingTitle = document.getElementById('nowPlayingTitle');
    const nowPlayingCategory = document.getElementById('nowPlayingCategory');
    const playerError = document.getElementById('playerError');
    const qualityControl = document.getElementById('qualityControl');
    const qualitySelector = document.getElementById('qualitySelector');
    const radioVisualizer = document.getElementById('radioVisualizer');
    
    // Player Action Buttons
    const favToggleBtn = document.getElementById('favToggleBtn');
    const favIcon = document.getElementById('favIcon');
    const shareBtn = document.getElementById('shareBtn');
    const pipBtn = document.getElementById('pipBtn');
    const miniPlayerBtn = document.getElementById('miniPlayerBtn');
    const fullscreenBtn = document.getElementById('fullscreenBtn');

    // Navigation & View Controls
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const themeToggleIcon = document.getElementById('themeToggleIcon');
    const viewToggleBtn = document.getElementById('viewToggleBtn');
    const viewToggleIcon = document.getElementById('viewToggleIcon');
    const toastNotification = document.getElementById('toastNotification');

    // Sidebar & Special Buttons
    const favsBtn = document.getElementById('favsBtn');
    const favsCount = document.getElementById('favsCount');
    const historyBtn = document.getElementById('historyBtn');
    const m3uImportBtn = document.getElementById('m3uImportBtn');
    const m3uModal = document.getElementById('m3uModal');
    const closeM3uModalBtn = document.getElementById('closeM3uModalBtn');
    const m3uUrlInput = document.getElementById('m3uUrlInput');
    const submitM3uBtn = document.getElementById('submitM3uBtn');

    // Mobile Elements
    const sidebar = document.querySelector('.sidebar');
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const mobileOverlay = document.getElementById('mobileOverlay');

    // State Variables
    let allCountries = [];
    let currentChannels = [];
    let hls = null;
    let selectedCategory = 'All';
    let currentSearchTerm = '';
    let globalSearchTimeout = null;
    let currentPlayingChannel = null;
    let fallbackUrls = [];
    let currentFallbackIndex = 0;

    // Initialize App
    initTheme();
    initViewMode();
    updateFavsBadge();
    fetchCountries();
    checkUrlParameters();

    // Mobile Sidebar Toggle
    function toggleSidebar() {
        sidebar.classList.toggle('active');
        if (sidebar.classList.contains('active')) {
            mobileOverlay.classList.add('active');
        } else {
            mobileOverlay.classList.remove('active');
        }
    }

    if (hamburgerBtn) hamburgerBtn.addEventListener('click', toggleSidebar);
    if (mobileOverlay) mobileOverlay.addEventListener('click', toggleSidebar);

    // --- Toast Notification ---
    function showToast(message) {
        toastNotification.textContent = message;
        toastNotification.classList.remove('hidden');
        setTimeout(() => {
            toastNotification.classList.add('hidden');
        }, 3000);
    }

    // --- Theme Management ---
    function initTheme() {
        const savedTheme = localStorage.getItem('freetv_theme') || 'dark';
        if (savedTheme === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
            themeToggleIcon.className = 'fa-solid fa-sun';
        } else {
            document.documentElement.removeAttribute('data-theme');
            themeToggleIcon.className = 'fa-solid fa-moon';
        }
    }

    themeToggleBtn.addEventListener('click', () => {
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        if (isLight) {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('freetv_theme', 'dark');
            themeToggleIcon.className = 'fa-solid fa-moon';
            showToast('🌙 Dark Mode Enabled');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('freetv_theme', 'light');
            themeToggleIcon.className = 'fa-solid fa-sun';
            showToast('☀️ Light Mode Enabled');
        }
    });

    // --- Grid / List View Toggle ---
    function initViewMode() {
        const savedView = localStorage.getItem('freetv_view') || 'grid';
        if (savedView === 'list') {
            channelGrid.classList.add('list-view');
            viewToggleIcon.className = 'fa-solid fa-table-cells-large';
        } else {
            channelGrid.classList.remove('list-view');
            viewToggleIcon.className = 'fa-solid fa-list';
        }
    }

    viewToggleBtn.addEventListener('click', () => {
        channelGrid.classList.toggle('list-view');
        const isList = channelGrid.classList.contains('list-view');
        localStorage.setItem('freetv_view', isList ? 'list' : 'grid');
        viewToggleIcon.className = isList ? 'fa-solid fa-table-cells-large' : 'fa-solid fa-list';
        showToast(isList ? '📋 List View Activated' : '🔲 Grid View Activated');
    });

    // --- Favorites Storage ---
    function getFavorites() {
        return JSON.parse(localStorage.getItem('freetv_favorites') || '[]');
    }

    function saveFavorites(favs) {
        localStorage.setItem('freetv_favorites', JSON.stringify(favs));
        updateFavsBadge();
    }

    function updateFavsBadge() {
        const favs = getFavorites();
        favsCount.textContent = favs.length;
    }

    function isFavorite(url) {
        const favs = getFavorites();
        return favs.some(f => f.url === url);
    }

    function toggleFavorite(channel) {
        let favs = getFavorites();
        const index = favs.findIndex(f => f.url === channel.url);
        if (index >= 0) {
            favs.splice(index, 1);
            showToast(`Removed "${channel.name}" from Favorites`);
        } else {
            favs.push(channel);
            showToast(`⭐ Added "${channel.name}" to Favorites`);
        }
        saveFavorites(favs);
        updateFavIcon(channel.url);
    }

    function updateFavIcon(url) {
        if (isFavorite(url)) {
            favIcon.className = 'fa-solid fa-star';
            favIcon.style.color = '#f59e0b';
        } else {
            favIcon.className = 'fa-regular fa-star';
            favIcon.style.color = '';
        }
    }

    // --- Watch History Storage ---
    function getHistory() {
        return JSON.parse(localStorage.getItem('freetv_history') || '[]');
    }

    function addToHistory(channel) {
        let history = getHistory();
        history = history.filter(h => h.url !== channel.url);
        history.unshift({ ...channel, watchedAt: new Date().toISOString() });
        if (history.length > 50) history.pop();
        localStorage.setItem('freetv_history', JSON.stringify(history));
    }

    // --- Special Sidebar Item Click Handlers ---
    favsBtn.addEventListener('click', () => {
        document.querySelectorAll('.country-item').forEach(el => el.classList.remove('active'));
        favsBtn.classList.add('active');
        selectedCountryTitle.textContent = '⭐ Favorite Channels';
        currentChannels = getFavorites();
        populateCategories(currentChannels);
        filterAndRenderChannels();
        if (window.innerWidth <= 768) toggleSidebar();
    });

    historyBtn.addEventListener('click', () => {
        document.querySelectorAll('.country-item').forEach(el => el.classList.remove('active'));
        historyBtn.classList.add('active');
        selectedCountryTitle.textContent = '🕒 Recently Watched';
        currentChannels = getHistory();
        populateCategories(currentChannels);
        filterAndRenderChannels();
        if (window.innerWidth <= 768) toggleSidebar();
    });

    const freePlaylistsBtn = document.getElementById('freePlaylistsBtn');
    const presetGrid = document.getElementById('presetGrid');

    fetchPresetPlaylists();

    async function fetchPresetPlaylists() {
        if (!presetGrid) return;
        try {
            const res = await fetch('/api/preset_playlists');
            if (!res.ok) return;
            const presets = await res.json();
            renderPresetGrid(presets);
        } catch (e) {
            console.error('Failed to load preset playlists', e);
        }
    }

    function renderPresetGrid(presets) {
        if (!presetGrid) return;
        presetGrid.innerHTML = '';
        presets.forEach(p => {
            const card = document.createElement('div');
            card.className = 'preset-card';
            card.innerHTML = `
                <i class="fa-solid ${p.icon}"></i>
                <h5>${p.name}</h5>
                <p>${p.description}</p>
            `;
            card.addEventListener('click', () => {
                m3uModal.classList.remove('active');
                loadPresetPlaylist(p);
            });
            presetGrid.appendChild(card);
        });
    }

    async function loadPresetPlaylist(preset) {
        channelGrid.innerHTML = '<div class="loading-spinner"></div>';
        selectedCountryTitle.textContent = `${preset.name}`;
        document.querySelectorAll('.country-item').forEach(el => el.classList.remove('active'));
        if (categoryFilters) categoryFilters.innerHTML = '';
        
        try {
            showToast(`Loading "${preset.name}" playlist...`);
            const response = await fetch(`/api/parse_m3u_url?url=${encodeURIComponent(preset.url)}`);
            if (!response.ok) throw new Error('Failed to load preset');
            const channels = await response.json();
            currentChannels = channels;
            populateCategories(currentChannels);
            filterAndRenderChannels();
            showToast(`Loaded ${channels.length} channels from ${preset.name}!`);
        } catch (e) {
            showToast(`Failed to load ${preset.name} streams.`);
            channelGrid.innerHTML = `
                <div class="placeholder-message">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    <p>Failed to load preset playlist streams.</p>
                </div>
            `;
        }
    }

    if (freePlaylistsBtn) {
        freePlaylistsBtn.addEventListener('click', () => {
            m3uModal.classList.add('active');
        });
    }

    // --- Custom M3U Modal Handlers ---
    m3uImportBtn.addEventListener('click', () => {
        m3uModal.classList.add('active');
    });

    closeM3uModalBtn.addEventListener('click', () => {
        m3uModal.classList.remove('active');
    });

    submitM3uBtn.addEventListener('click', async () => {
        const url = m3uUrlInput.value.trim();
        if (!url) {
            showToast('Please enter a valid M3U URL');
            return;
        }

        submitM3uBtn.disabled = true;
        submitM3uBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';

        try {
            const response = await fetch(`/api/parse_m3u_url?url=${encodeURIComponent(url)}`);
            if (!response.ok) throw new Error('Failed to load playlist');
            const channels = await response.json();
            
            if (channels.length === 0) {
                showToast('No channels found in M3U file');
            } else {
                m3uModal.classList.remove('active');
                document.querySelectorAll('.country-item').forEach(el => el.classList.remove('active'));
                selectedCountryTitle.textContent = `📁 Custom M3U (${channels.length} channels)`;
                currentChannels = channels;
                populateCategories(currentChannels);
                filterAndRenderChannels();
                showToast(`Loaded ${channels.length} channels successfully!`);
            }
        } catch (e) {
            showToast('Error loading M3U playlist from URL');
        } finally {
            submitM3uBtn.disabled = false;
            submitM3uBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-down"></i> Load Playlist';
        }
    });

    // --- Fetch & Render Countries ---
    async function fetchCountries() {
        try {
            const response = await fetch('/api/countries');
            if (!response.ok) throw new Error('Failed to load');
            allCountries = await response.json();
            renderCountries(allCountries);
        } catch (error) {
            console.error(error);
            countryList.innerHTML = `<li class="country-item" style="color: red;">Failed to load countries. Is backend running?</li>`;
        }
    }

    function renderCountries(countries) {
        countryList.innerHTML = '';
        countries.forEach(country => {
            if (!country.code) return;
            const li = document.createElement('li');
            li.className = 'country-item';
            
            const code = country.code.toUpperCase();
            const flag = code.replace(/./g, char => String.fromCodePoint(char.charCodeAt(0) + 127397));

            li.innerHTML = `
                <span class="flag">${flag}</span>
                <span class="country-name">${country.name}</span>
            `;
            
            li.addEventListener('click', () => {
                document.querySelectorAll('.country-item').forEach(el => el.classList.remove('active'));
                li.classList.add('active');
                selectedCountryTitle.textContent = `${country.name} Channels`;
                loadChannels(country.code);
                if (window.innerWidth <= 768) toggleSidebar();
            });

            countryList.appendChild(li);
        });
    }

    async function loadChannels(countryCode) {
        channelGrid.innerHTML = '<div class="loading-spinner"></div>';
        if (categoryFilters) categoryFilters.innerHTML = '';
        selectedCategory = 'All';
        try {
            const response = await fetch(`/api/channels/${countryCode}`);
            if (!response.ok) throw new Error('Failed to load channels');
            currentChannels = await response.json();
            populateCategories(currentChannels);
            filterAndRenderChannels();
        } catch (error) {
            console.error(error);
            channelGrid.innerHTML = `
                <div class="placeholder-message">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    <p>Error loading channels.</p>
                </div>
            `;
        }
    }

    function populateCategories(channels) {
        if (!categoryFilters || !channels || channels.length === 0) {
            if (categoryFilters) categoryFilters.innerHTML = '';
            return;
        }

        const categories = new Set();
        channels.forEach(c => {
            const cat = c['group-title'];
            if (cat) {
                cat.split(';').forEach(subcat => {
                    const trimmed = subcat.trim();
                    if (trimmed) categories.add(trimmed);
                });
            }
        });

        const sortedCategories = Array.from(categories).sort();
        
        let html = `<button class="category-chip active" data-category="All">All</button>`;
        sortedCategories.forEach(cat => {
            html += `<button class="category-chip" data-category="${cat}">${cat}</button>`;
        });
        
        categoryFilters.innerHTML = html;
        
        categoryFilters.querySelectorAll('.category-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                categoryFilters.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
                e.target.classList.add('active');
                selectedCategory = e.target.getAttribute('data-category');
                filterAndRenderChannels();
            });
        });
    }

    function filterAndRenderChannels() {
        let filtered = currentChannels;
        
        if (selectedCategory !== 'All') {
            filtered = filtered.filter(c => {
                const cat = c['group-title'] || '';
                return cat.split(';').map(s => s.trim()).includes(selectedCategory);
            });
        }
        
        if (currentSearchTerm) {
            filtered = filtered.filter(c => 
                c.name.toLowerCase().includes(currentSearchTerm) || 
                (c['group-title'] && c['group-title'].toLowerCase().includes(currentSearchTerm))
            );
        }
        
        renderChannels(filtered);
    }

    function renderChannels(channels) {
        if (channels.length === 0) {
            channelGrid.innerHTML = `
                <div class="placeholder-message">
                    <i class="fa-regular fa-face-frown"></i>
                    <p>No channels found.</p>
                </div>
            `;
            return;
        }

        channelGrid.innerHTML = '';
        channels.forEach((channel, index) => {
            const card = document.createElement('div');
            card.className = 'channel-card';
            card.setAttribute('tabindex', '0'); // Smart TV focusable
            card.setAttribute('data-index', index);
            
            const logoUrl = channel['tvg-logo'] || 'https://via.placeholder.com/80x80/1e293b/FFFFFF?text=TV';
            const category = channel['group-title'] || 'General';
            const isFav = isFavorite(channel.url);

            card.innerHTML = `
                <span class="card-status-badge">
                    <i class="fa-solid fa-circle"></i> Live
                </span>
                <button class="card-fav-btn ${isFav ? 'active' : ''}" title="Favorite">
                    <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-star"></i>
                </button>
                <img src="${logoUrl}" alt="${channel.name} logo" class="channel-logo" onerror="this.src='https://via.placeholder.com/80x80/1e293b/FFFFFF?text=TV'">
                <div class="channel-info">
                    <h4 class="channel-name" title="${channel.name}">${channel.name}</h4>
                    <span class="channel-category" title="${category}">${category}</span>
                </div>
            `;

            // Star Favorite Click
            const starBtn = card.querySelector('.card-fav-btn');
            starBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleFavorite(channel);
                starBtn.classList.toggle('active');
                const i = starBtn.querySelector('i');
                i.className = isFavorite(channel.url) ? 'fa-solid fa-star' : 'fa-regular fa-star';
            });

            card.addEventListener('click', () => {
                playChannel(channel);
            });

            channelGrid.appendChild(card);
        });
    }

    // --- Stream Playing & Recovery ---
    function playChannel(channel) {
        currentPlayingChannel = channel;
        addToHistory(channel);
        updateFavIcon(channel.url);
        loadStreamWithRecovery(channel.name, channel.url, channel['group-title']);
    }

    async function loadStreamWithRecovery(name, url, category = 'Live') {
        nowPlayingTitle.textContent = name;
        nowPlayingCategory.textContent = category || 'Live';
        playerModal.classList.add('active');
        playerModal.classList.remove('mini-mode');
        playerError.classList.add('hidden');
        qualityControl.classList.add('hidden');
        radioVisualizer.classList.add('hidden');
        qualitySelector.innerHTML = '<option value="-1">Auto</option>';
        
        fallbackUrls = [url];
        currentFallbackIndex = 0;

        const isRadio = name.includes('📻') || (category && category.toLowerCase().includes('radio'));
        if (isRadio) {
            radioVisualizer.classList.remove('hidden');
        }

        playFallbackUrl();

        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(name.substring(0, 8))}`);
            if (response.ok) {
                const matches = await response.json();
                const strictMatches = matches.filter(m => 
                    m.name.toLowerCase().includes(name.toLowerCase().substring(0, 5))
                );
                
                let urls = strictMatches.map(m => m.url);
                urls = [...new Set(urls)].filter(u => u !== url);
                fallbackUrls = [url, ...urls];
            }
        } catch(e) {
            console.log("Failed to fetch backups");
        }
    }

    function playFallbackUrl() {
        if (currentFallbackIndex >= fallbackUrls.length) {
            playerError.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i><p>Stream offline and no backups available.</p>';
            playerError.classList.remove('hidden');
            return;
        }
        
        const currentUrl = fallbackUrls[currentFallbackIndex];
        
        if (currentFallbackIndex > 0) {
            playerError.innerHTML = `<div class="loading-spinner"></div><p>Connecting to Backup Stream ${currentFallbackIndex}/${fallbackUrls.length - 1}...</p>`;
            playerError.classList.remove('hidden');
        }

        const isM3U8 = currentUrl.toLowerCase().includes('.m3u8');
        const isM3U = currentUrl.toLowerCase().includes('.m3u');
        const isRadio = !isM3U8 && !isM3U;

        if (!isRadio && Hls.isSupported()) {
            if (hls) hls.destroy();
            hls = new Hls({
                maxBufferLength: 30,
                lowLatencyMode: true,
                liveSyncDurationCount: 3,
                liveMaxLatencyDurationCount: 10
            });
            hls.loadSource(currentUrl);
            hls.attachMedia(videoPlayer);
            
            hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
                playerError.classList.add('hidden');
                qualityControl.classList.remove('hidden');
                let optionsHTML = '<option value="-1">Auto</option>';
                data.levels.forEach((level, index) => {
                    const label = level.height ? `${level.height}p` : `${Math.round(level.bitrate / 1000)}kbps`;
                    optionsHTML += `<option value="${index}">${label}</option>`;
                });
                qualitySelector.innerHTML = optionsHTML;
                videoPlayer.play().catch(e => console.log('Autoplay prevented:', e));
            });
            
            qualitySelector.onchange = (e) => {
                if (hls) hls.currentLevel = parseInt(e.target.value);
            };

            hls.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                        hls.destroy();
                        currentFallbackIndex++;
                        playFallbackUrl();
                    } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                        hls.recoverMediaError();
                    } else {
                        hls.destroy();
                        currentFallbackIndex++;
                        playFallbackUrl();
                    }
                }
            });
        } else if (isRadio || videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
            videoPlayer.src = currentUrl;
            videoPlayer.addEventListener('loadedmetadata', () => {
                playerError.classList.add('hidden');
                videoPlayer.play().catch(e => console.log('Autoplay prevented:', e));
            });
            videoPlayer.addEventListener('error', () => {
                currentFallbackIndex++;
                playFallbackUrl();
            }, { once: true });
        }
    }

    // --- Player Action Controls ---
    favToggleBtn.addEventListener('click', () => {
        if (currentPlayingChannel) {
            toggleFavorite(currentPlayingChannel);
        }
    });

    shareBtn.addEventListener('click', () => {
        if (currentPlayingChannel) {
            const shareUrl = `${window.location.origin}${window.location.pathname}?name=${encodeURIComponent(currentPlayingChannel.name)}&url=${encodeURIComponent(currentPlayingChannel.url)}`;
            navigator.clipboard.writeText(shareUrl).then(() => {
                showToast('🔗 Direct Channel Link copied to clipboard!');
            }).catch(() => {
                showToast('Share Link: ' + shareUrl);
            });
        }
    });

    pipBtn.addEventListener('click', async () => {
        if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
        } else if (document.pictureInPictureEnabled && videoPlayer) {
            try {
                await videoPlayer.requestPictureInPicture();
                showToast('📺 Picture-in-Picture Activated');
            } catch (e) {
                showToast('Picture-in-Picture not supported on this stream');
            }
        }
    });

    miniPlayerBtn.addEventListener('click', () => {
        playerModal.classList.toggle('mini-mode');
        const isMini = playerModal.classList.contains('mini-mode');
        showToast(isMini ? '📌 Floating Mini-Player Active' : '📺 Expanded View');
    });

    fullscreenBtn.addEventListener('click', () => {
        if (videoContainer.requestFullscreen) {
            videoContainer.requestFullscreen();
        } else if (videoContainer.webkitRequestFullscreen) {
            videoContainer.webkitRequestFullscreen();
        }
    });

    function closePlayer() {
        playerModal.classList.remove('active');
        playerModal.classList.remove('mini-mode');
        videoPlayer.pause();
        videoPlayer.removeAttribute('src');
        if (hls) {
            hls.destroy();
            hls = null;
        }
    }

    closePlayerBtn.addEventListener('click', closePlayer);

    // --- Global & Local Search Listeners ---
    globalSearch.addEventListener('input', (e) => {
        const term = e.target.value.trim();
        if (globalSearchTimeout) clearTimeout(globalSearchTimeout);
        if (term.length < 2) return;
        globalSearchTimeout = setTimeout(() => {
            performGlobalSearch(term);
        }, 500);
    });

    async function performGlobalSearch(term) {
        channelGrid.innerHTML = `
            <div class="placeholder-message">
                <div class="loading-spinner"></div>
                <p>Searching global streams...</p>
            </div>
        `;
        selectedCountryTitle.textContent = `Search Results: "${term}"`;
        document.querySelectorAll('.country-item').forEach(el => el.classList.remove('active'));
        if (categoryFilters) categoryFilters.innerHTML = '';
        currentChannels = [];
        selectedCategory = 'All';
        currentSearchTerm = '';
        if (channelSearch) channelSearch.value = '';
        
        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
            if (!response.ok) throw new Error('Search failed');
            const results = await response.json();
            currentChannels = results;
            populateCategories(currentChannels);
            filterAndRenderChannels();
            if (window.innerWidth <= 768) toggleSidebar();
        } catch (error) {
            console.error(error);
            channelGrid.innerHTML = `
                <div class="placeholder-message">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    <p>Failed to search database.</p>
                </div>
            `;
        }
    }

    countrySearch.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allCountries.filter(c => c.name.toLowerCase().includes(term));
        renderCountries(filtered);
    });

    channelSearch.addEventListener('input', (e) => {
        currentSearchTerm = e.target.value.toLowerCase();
        filterAndRenderChannels();
    });

    // --- URL Search Params Direct Channel Loader ---
    function checkUrlParameters() {
        const params = new URLSearchParams(window.location.search);
        const name = params.get('name');
        const url = params.get('url');
        if (name && url) {
            playChannel({ name, url, 'group-title': 'Shared Link' });
        }
    }

    // --- Smart TV Keyboard Navigation ---
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closePlayer();
            m3uModal.classList.remove('active');
            return;
        }

        const focused = document.activeElement;
        if (focused && focused.classList.contains('channel-card')) {
            const cards = Array.from(document.querySelectorAll('.channel-card'));
            const idx = cards.indexOf(focused);
            if (idx === -1) return;

            if (e.key === 'ArrowRight' && idx < cards.length - 1) {
                cards[idx + 1].focus();
                e.preventDefault();
            } else if (e.key === 'ArrowLeft' && idx > 0) {
                cards[idx - 1].focus();
                e.preventDefault();
            } else if (e.key === 'ArrowDown' && idx + 4 < cards.length) {
                cards[idx + 4].focus();
                e.preventDefault();
            } else if (e.key === 'ArrowUp' && idx - 4 >= 0) {
                cards[idx - 4].focus();
                e.preventDefault();
            } else if (e.key === 'Enter') {
                focused.click();
                e.preventDefault();
            }
        }
    });
});
