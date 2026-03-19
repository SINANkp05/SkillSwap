document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const swapId = urlParams.get('swapId');
    const loggedInUser = JSON.parse(localStorage.getItem('user'));

    if (!loggedInUser || !swapId) {
        window.location.href = 'dashboard.html';
        return;
    }

    const messagesContainer = document.getElementById('chatMessages');
    const chatForm = document.getElementById('chatForm');
    const messageInput = document.getElementById('messageInput');
    const otherUserNameEl = document.getElementById('otherUserName');
    const otherUserAvatarEl = document.getElementById('otherUserAvatar');

    let lastMessageCount = 0;

    // Emoji Picker Logic
    const toggleEmojiBtn = document.getElementById('toggleEmojiBtn');
    const emojiPicker = document.getElementById('emojiPicker');
    const emojiBtns = document.querySelectorAll('.emoji-btn');

    if (toggleEmojiBtn && emojiPicker) {
        toggleEmojiBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            emojiPicker.classList.toggle('visible');
            toggleEmojiBtn.style.color = emojiPicker.classList.contains('visible') ? 'var(--primary)' : 'var(--text-muted)';
        });

        emojiBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                messageInput.value += e.target.textContent;
                emojiPicker.classList.remove('visible');
                toggleEmojiBtn.style.color = 'var(--text-muted)';
                messageInput.focus();
            });
        });

        document.addEventListener('click', (e) => {
            if (!chatForm.contains(e.target)) {
                emojiPicker.classList.remove('visible');
                toggleEmojiBtn.style.color = 'var(--text-muted)';
            }
        });
    }

    // Load Chat Partner Info
    async function loadPartnerInfo() {
        try {
            const res = await fetch(`/api/swaps/me?userId=${loggedInUser.id}`);
            if (!res.ok) throw new Error("Failed to load swap info");
            const swaps = await res.json();
            const currentSwap = swaps.find(s => s.id == swapId);

            if (currentSwap) {
                otherUserNameEl.textContent = currentSwap.otherUser.name;
                otherUserAvatarEl.src = currentSwap.otherUser.avatar;
            }
        } catch (err) {
            console.error("Error loading partner info:", err);
        }
    }

    // Load Messages
    async function loadMessages() {
        try {
            const res = await fetch(`/api/messages/${swapId}`);
            if (!res.ok) throw new Error("Failed to load messages");
            const messages = await res.json();

            // Only update if there are new messages
            if (messages.length > lastMessageCount) {
                renderMessages(messages);
                lastMessageCount = messages.length;
                scrollToBottom();
            }
        } catch (err) {
            console.error("Error loading messages:", err);
        }
    }

    function renderMessages(messages) {
        // Keep the lock icon / header message
        const headerHtml = `<div style="text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.9rem;">
            <i class="fa-solid fa-lock" style="margin-right: 5px;"></i> Messages are professionally secured
        </div>`;

        let html = headerHtml;
        messages.forEach(msg => {
            const isSent = msg.sender_id == loggedInUser.id;
            const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            html += `
                <div class="message ${isSent ? 'message-sent' : 'message-received'}">
                    ${msg.text}
                    <span class="message-time">${time}</span>
                </div>
            `;
        });
        
        // Add typing indicator shell at the bottom
        html += `
            <div class="typing-indicator" id="typingIndicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;
        
        messagesContainer.innerHTML = html;
    }

    function scrollToBottom() {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Send Message
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = messageInput.value.trim();
        if (!text) return;

        messageInput.value = '';

        try {
            const res = await fetch(`/api/messages/${swapId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ senderId: loggedInUser.id, text })
            });

            if (res.ok) {
                loadMessages(); // Refresh immediately after sending
            }
        } catch (err) {
            console.error("Error sending message:", err);
        }
    });

    // Initial Load
    await loadPartnerInfo();
    await loadMessages();

    // Typing simulation just for visual completion (simulates other user typing)
    let typingTimer;
    function simulateTyping() {
        const ind = document.getElementById('typingIndicator');
        if (!ind) return;
        
        if (Math.random() > 0.85) { // 15% chance to show typing indicator per poll
            ind.style.display = 'flex';
            scrollToBottom();
            
            clearTimeout(typingTimer);
            typingTimer = setTimeout(() => {
                if (ind) ind.style.display = 'none';
            }, 2500);
        }
    }

    // Polling for new messages every 3 seconds
    setInterval(() => {
        loadMessages();
        simulateTyping();
    }, 3000);
});
