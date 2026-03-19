// =============================================
// Global Utilities
// =============================================

// Global toast notification system
window.showToast = function (message, type = 'info', duration = 3500) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const iconMap = {
        success: 'fa-circle-check',
        error: 'fa-circle-xmark',
        info: 'fa-circle-info',
        warning: 'fa-triangle-exclamation'
    };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fa-solid ${iconMap[type] || iconMap.info} toast-icon"></i><span class="toast-msg">${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 400);
    }, duration);
};

// =============================================
// Notification System
// =============================================
window.loadNotifications = async function () {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return;

    const badge = document.getElementById('notifBadge');
    const list = document.getElementById('notifList');

    try {
        // Fetch unread count
        const countRes = await fetch(`/api/notifications/${user.id}/unread-count`);
        if (countRes.ok) {
            const { count } = await countRes.json();
            if (badge) {
                badge.textContent = count > 9 ? '9+' : count;
                badge.classList.toggle('visible', count > 0);
                badge.classList.toggle('pulse', count > 0);
            }
        }

        // Fetch notifications list
        if (!list) return;
        const res = await fetch(`/api/notifications/${user.id}`);
        if (!res.ok) return;
        const notifications = await res.json();

        if (notifications.length === 0) {
            list.innerHTML = `<div class="notif-empty"><i class="fa-solid fa-bell-slash" style="font-size:1.5rem;margin-bottom:0.5rem;"></i><br>No notifications yet</div>`;
            return;
        }

        const typeIconMap = {
            swap_request: { icon: 'fa-handshake', cls: 'swap' },
            swap_accepted: { icon: 'fa-check', cls: 'swap' },
            swap_complete: { icon: 'fa-trophy', cls: 'swap' },
            like: { icon: 'fa-heart', cls: 'like' },
            comment: { icon: 'fa-comment', cls: 'comment' },
            rating: { icon: 'fa-star', cls: 'rating' }
        };

        list.innerHTML = notifications.map(n => {
            const iconData = typeIconMap[n.type] || { icon: 'fa-bell', cls: 'swap' };
            const timeAgo = getTimeAgo(new Date(n.created_at));
            return `
                <div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="handleNotifClick(${n.id}, '${n.link || ''}')">
                    <div class="notif-item-icon ${iconData.cls}"><i class="fa-solid ${iconData.icon}"></i></div>
                    <div class="notif-item-text">
                        <p>${n.message}</p>
                        <span>${timeAgo}</span>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('Notification load error:', err);
    }
};

window.handleNotifClick = function (notifId, link) {
    if (link) window.location.href = link;
};

window.readAllNotifications = async function () {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return;
    await fetch('/api/notifications/read-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
    });
    const badge = document.getElementById('notifBadge');
    if (badge) { badge.classList.remove('visible', 'pulse'); badge.textContent = '0'; }
    window.loadNotifications();
};

function getTimeAgo(date) {
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

// =============================================
// Users Data State
// =============================================
let usersData = [];
const feedContainer = document.getElementById('feedContainer');
const tabBtns = document.querySelectorAll('.tab-btn');
const navbar = document.querySelector('.navbar');
const loadMoreBtn = document.querySelector('.load-more');
const mainSearchInput = document.getElementById('mainSearch');
const searchBtn = document.querySelector('.search-bar .btn');

let visibleCount = 6;
let currentTab = 'needing-help';
let searchQuery = '';
let skillFilter = '';

// =============================================
// Initialize
// =============================================
document.addEventListener('DOMContentLoaded', async () => {
    // Fetch feed data
    if (feedContainer) {
        try {
            const response = await fetch('/api/feed');
            if (response.ok) {
                usersData = await response.json();
                renderFeed('needing-help');

                // Build skill filter chips on index page
                const chipsContainer = document.getElementById('skillFilterChips');
                if (chipsContainer) {
                    const allSkills = [...new Set(usersData.flatMap(u => [...(u.offers || []), ...(u.needs || [])]))].slice(0, 12);
                    chipsContainer.innerHTML = allSkills.map(skill =>
                        `<button class="skill-chip" onclick="filterBySkill('${skill}')">${skill}</button>`
                    ).join('');
                }
            } else {
                if (feedContainer) feedContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted);">Could not load feed. Please ensure the server is running.</p>';
            }
        } catch (err) {
            console.error("Error fetching feed:", err);
            if (feedContainer) feedContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted);">Network error. Try again later.</p>';
        }
    }

    // Count-up animation for hero stats
    document.querySelectorAll('.stat-num[data-target]').forEach(el => {
        const target = parseInt(el.getAttribute('data-target'));
        let current = 0;
        const step = Math.ceil(target / 50);
        const timer = setInterval(() => {
            current = Math.min(current + step, target);
            el.textContent = current.toLocaleString() + (el.dataset.suffix || '');
            if (current >= target) clearInterval(timer);
        }, 30);
    });

    // Navbar scroll effect
    if (navbar) {
        window.addEventListener('scroll', () => {
            navbar.classList.toggle('scrolled', window.scrollY > 50);
        });
    }

    // Mobile menu toggle — unified for all pages
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const navLinksEl = document.querySelector('.nav-links');
    const navActionsEl = document.querySelector('.nav-actions');
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            const isOpen = mobileMenuBtn.classList.toggle('open');
            if (navLinksEl) navLinksEl.classList.toggle('mobile-open', isOpen);
            if (navActionsEl) navActionsEl.classList.toggle('mobile-open', isOpen);
            mobileMenuBtn.innerHTML = isOpen ? '<i class="fa-solid fa-xmark"></i>' : '<i class="fa-solid fa-bars"></i>';
        });
        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!mobileMenuBtn.contains(e.target) && !navLinksEl?.contains(e.target) && !navActionsEl?.contains(e.target)) {
                mobileMenuBtn.classList.remove('open');
                navLinksEl?.classList.remove('mobile-open');
                navActionsEl?.classList.remove('mobile-open');
                mobileMenuBtn.innerHTML = '<i class="fa-solid fa-bars"></i>';
            }
        });
    }

    // Intersection observer for section animations
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-links a');
    if (navLinks.length > 0) {
        const navObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.getAttribute('id');
                    navLinks.forEach(link => {
                        link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
                    });
                }
            });
        }, { threshold: 0.4 });
        sections.forEach(section => navObserver.observe(section));
    }

    // Fade-in on scroll
    const animateElements = document.querySelectorAll('.how-it-works, .discover-hub, .cta-section');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });
    animateElements.forEach(el => { el.style.opacity = "0"; observer.observe(el); });

    // Tab switching
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            tabBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            if (feedContainer) feedContainer.style.opacity = '0';
            setTimeout(() => {
                currentTab = e.target.dataset.tab;
                visibleCount = 6;
                skillFilter = '';
                // Remove active from all chips
                document.querySelectorAll('.skill-chip').forEach(c => c.classList.remove('active'));
                renderFeed(currentTab);
                if (feedContainer) { feedContainer.style.opacity = '1'; feedContainer.style.transition = 'opacity 0.3s ease'; }
            }, 200);
        });
    });

    // Load More
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            visibleCount += 6;
            renderFeed(currentTab);
        });
    }

    // Search bar
    if (mainSearchInput && searchBtn) {
        const handleSearchEvent = () => {
            searchQuery = mainSearchInput.value.trim().toLowerCase();
            skillFilter = '';
            document.querySelectorAll('.skill-chip').forEach(c => c.classList.remove('active'));
            const discoverSection = document.getElementById('discover');
            if (discoverSection) discoverSection.scrollIntoView({ behavior: 'smooth' });
            visibleCount = 6;
            renderFeed(currentTab);
        };
        searchBtn.addEventListener('click', handleSearchEvent);
        mainSearchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSearchEvent(); });
    }

    // Auth state
    const user = JSON.parse(localStorage.getItem('user'));
    const navAuthArea = document.getElementById('navAuthArea');
    if (navAuthArea) {
        if (user) {
            const avatarUrl = user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=45a29e&color=fff`;
            navAuthArea.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div class="notif-btn-wrapper">
                        <button class="notif-bell-btn" id="notifBellBtn" aria-label="Notifications">
                            <i class="fa-solid fa-bell"></i>
                        </button>
                        <span class="notif-badge" id="notifBadge">0</span>
                        <div class="notif-dropdown" id="notifDropdown">
                            <div class="notif-header">
                                <h4>Notifications</h4>
                                <span class="notif-read-all" onclick="readAllNotifications()">Mark all read</span>
                            </div>
                            <div class="notif-list" id="notifList">
                                <div class="notif-empty">Loading...</div>
                            </div>
                        </div>
                    </div>
                    <a href="profile.html?id=${user.id}">
                        <img src="${avatarUrl}" alt="Profile" style="width:40px;height:40px;border-radius:50%;border:2px solid var(--primary);object-fit:cover;">
                    </a>
                    <span style="font-weight:500;font-size:0.9rem;">Hi, ${(user.first_name || user.name || '').split(' ')[0]}</span>
                    <button class="btn btn-secondary" onclick="logout()" style="padding:8px 16px;font-size:0.85rem;">Logout</button>
                </div>
            `;

            // Notification bell toggle
            const bellBtn = document.getElementById('notifBellBtn');
            const dropdown = document.getElementById('notifDropdown');
            if (bellBtn && dropdown) {
                bellBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    dropdown.classList.toggle('open');
                    if (dropdown.classList.contains('open')) window.loadNotifications();
                });
                document.addEventListener('click', (e) => {
                    if (!dropdown.contains(e.target) && !bellBtn.contains(e.target)) {
                        dropdown.classList.remove('open');
                    }
                });
            }

            // Load initial unread count
            window.loadNotifications();
        }
    }
});

// =============================================
// Skill Filter (for index discover section)
// =============================================
window.filterBySkill = function (skill) {
    skillFilter = skill === skillFilter ? '' : skill;
    searchQuery = '';
    if (mainSearchInput) mainSearchInput.value = '';
    document.querySelectorAll('.skill-chip').forEach(c => {
        c.classList.toggle('active', c.textContent.trim() === skill && skillFilter !== '');
    });
    visibleCount = 6;
    renderFeed(currentTab);
};

// =============================================
// Logout
// =============================================
window.logout = function () {
    localStorage.removeItem('user');
    showToast('You have been logged out. See you soon! 👋', 'info');
    setTimeout(() => { window.location.href = 'index.html'; }, 1000);
};

// =============================================
// Rank Logic
// =============================================
window.getRankInfo = function (score) {
    if (score < 20) return { name: "Novice", class: "rank-novice", icon: "fa-seedling" };
    if (score < 40) return { name: "Apprentice", class: "rank-apprentice", icon: "fa-leaf" };
    if (score < 60) return { name: "Adept", class: "rank-adept", icon: "fa-book" };
    if (score < 80) return { name: "Expert", class: "rank-expert", icon: "fa-hat-wizard" };
    if (score < 100) return { name: "Master", class: "rank-master", icon: "fa-medal" };
    if (score < 150) return { name: "Grandmaster", class: "rank-grandmaster", icon: "fa-crown" };
    if (score < 200) return { name: "Legend", class: "rank-legend", icon: "fa-gem" };
    return { name: "Mythic", class: "rank-mythic", icon: "fa-fire" };
};
const getRankInfo = window.getRankInfo;

// =============================================
// Global Swap Handler
// =============================================
window.handleSwap = async function (targetUserId) {
    const loggedInUser = JSON.parse(localStorage.getItem('user'));
    if (!loggedInUser) {
        showToast('Please log in to request a swap!', 'warning');
        setTimeout(() => { window.location.href = 'login.html'; }, 1500);
        return;
    }

    try {
        const response = await fetch('/api/swaps/request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requesterId: loggedInUser.id, receiverId: targetUserId })
        });
        const data = await response.json();
        if (response.ok) {
            showToast("Swap request sent! 🤝 Track it in your Dashboard.", 'success');
        } else {
            showToast(data.error || "Could not send swap request.", 'warning');
        }
    } catch (err) {
        showToast("Network error — couldn't send request.", 'error');
    }
};

// =============================================
// Render Feed
// =============================================
function renderFeed(filterType) {
    if (!feedContainer) return;

    // Show skeleton loaders while processing
    feedContainer.innerHTML = '';

    let filteredData = usersData.filter(user => user.type === filterType);

    // Apply search filter
    if (searchQuery) {
        filteredData = filteredData.filter(user => {
            return [user.name, user.title, user.description, ...(user.offers || []), ...(user.needs || [])]
                .join(' ').toLowerCase().includes(searchQuery);
        });
    }

    // Apply skill chip filter
    if (skillFilter) {
        filteredData = filteredData.filter(user => {
            return [...(user.offers || []), ...(user.needs || [])].some(s => s === skillFilter);
        });
    }

    const dataToShow = filteredData.slice(0, visibleCount);

    if (loadMoreBtn) {
        loadMoreBtn.parentElement.style.display = filteredData.length > visibleCount ? 'flex' : 'none';
    }

    if (filteredData.length === 0) {
        const query = searchQuery || skillFilter || currentTab;
        feedContainer.innerHTML = `
            <div class="glass-panel" style="grid-column: 1 / -1; padding: 4rem; text-align: center;">
                <i class="fa-solid fa-face-frown fa-3x" style="color: var(--text-muted); margin-bottom: 1rem;"></i>
                <h3>No matches found</h3>
                <p style="color:var(--text-muted);">Try a different search or browse other categories.</p>
                <button class="btn btn-secondary" style="margin-top:1rem;" onclick="clearSearch()">Clear Filter</button>
            </div>
        `;
        return;
    }

    dataToShow.forEach(user => {
        const rankInfo = getRankInfo(user.score);
        const card = document.createElement('div');
        card.className = `user-card glass-panel ranked fade-in ${rankInfo.class}`;

        const offersHtml = (user.offers || []).map(s => `<span class="skill-badge offering"><i class="fa-solid fa-check"></i> ${s}</span>`).join('');
        const needsHtml = (user.needs || []).map(s => `<span class="skill-badge needing"><i class="fa-solid fa-magnifying-glass"></i> ${s}</span>`).join('');

        card.innerHTML = `
            <div class="card-header">
                <img src="${user.avatar}" alt="${user.name}" class="avatar">
                <div class="user-details" style="flex:1;">
                    <h4>${user.name}</h4>
                    <p class="user-title">${user.title}</p>
                    <p class="score-display">Score: <strong>${user.score}</strong> pts</p>
                </div>
                <div class="rank-badge"><i class="fa-solid ${rankInfo.icon}"></i> ${rankInfo.name}</div>
            </div>
            <div class="card-badges">${offersHtml}${needsHtml}</div>
            <p class="card-description">&quot;${user.description}&quot;</p>
            <div class="card-actions">
                <a href="profile.html?id=${user.id}" class="btn btn-secondary" title="View Profile"><i class="fa-solid fa-user"></i></a>
                <button class="btn btn-primary" style="flex:4;" onclick="handleSwap(${user.id})">Request Swap</button>
            </div>
        `;
        feedContainer.appendChild(card);
    });
}

// Clear search & skill filters
window.clearSearch = function () {
    if (mainSearchInput) mainSearchInput.value = '';
    searchQuery = '';
    skillFilter = '';
    visibleCount = 6;
    document.querySelectorAll('.skill-chip').forEach(c => c.classList.remove('active'));
    renderFeed(currentTab);
};
