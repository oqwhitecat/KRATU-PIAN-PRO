// --- API Endpoint Configuration ---
const API_URL_USER = 'http://localhost:3000';    // For posts from the web UI
const API_URL_POSTMAN = 'http://localhost:3001'; // For posts from Postman

document.addEventListener('DOMContentLoaded', () => {

    // ==========================================================
    // SECTION 1: User Authentication (Login, Register, Logout)
    // ==========================================================
    
    // --- Register Logic ---
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            // BUG 1 (Validation): จงใจไม่ตรวจสอบความยาวรหัสผ่าน
            const username = document.getElementById('reg-username').value;
            if (!username || !document.getElementById('reg-password').value) {
                alert('กรุณากรอกข้อมูลให้ครบถ้วน');
                return;
            }
            localStorage.setItem('kratu_pian_user', username);
            alert('สมัครสมาชิกสำเร็จ! กำลังนำท่านไปหน้าหลัก...');
            window.location.href = 'home.html';
        });
    }

    // --- Login Logic ---
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            if (!username || !document.getElementById('password').value) {
                alert('กรุณากรอกข้อมูลให้ครบถ้วน');
                return;
            }
            localStorage.setItem('kratu_pian_user', username);
            alert('เข้าสู่ระบบสำเร็จ! กำลังนำท่านไปหน้าหลัก...');
            window.location.href = 'home.html';
        });
    }
    
    // --- Logout Logic ---
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('kratu_pian_user');
            alert('ออกจากระบบสำเร็จ!');
            window.location.href = 'index.html';
        });
    }

    // ==========================================================
    // SECTION 2: Post Management (CRUD via API)
    // ==========================================================

    // --- Create Post Logic ---
    const createPostForm = document.getElementById('create-post-form');
    if (createPostForm) {
        createPostForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const newPost = {
                title: document.getElementById('post-title').value,
                content: document.getElementById('post-content').value,
                author: localStorage.getItem('kratu_pian_user') || "Anonymous",
                attachment: document.getElementById('post-file').value.split('\\').pop(),
                likes: 0,
                createdAt: new Date().toISOString()
            };

            fetch(`${API_URL_USER}/posts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newPost),
            })
            .then(() => window.location.href = 'home.html')
            .catch(error => {
                console.error('Error creating post:', error);
                alert('เกิดข้อผิดพลาดในการสร้างกระทู้! กรุณาตรวจสอบว่า JSON Server (Port 3000) ทำงานอยู่');
            });
        });
    }

    // --- Read Posts & Comments Logic ---
    const postContainer = document.getElementById('post-container');
    if (postContainer) {
        Promise.all([
            fetch(`${API_URL_USER}/posts`).then(res => res.json()),
            fetch(`${API_URL_USER}/comments`).then(res => res.json()),
            fetch(`${API_URL_POSTMAN}/posts`).then(res => res.json())
        ])
        .then(([userPosts, userComments, postmanPosts]) => {
            const taggedUserPosts = userPosts.map(post => ({ ...post, source: 'Web' }));
            const taggedPostmanPosts = postmanPosts.map(post => ({ ...post, source: 'API Test' }));
            const allPosts = [...taggedUserPosts, ...taggedPostmanPosts];

            if (allPosts.length === 0) {
                postContainer.innerHTML = '<p>ยังไม่มีกระทู้ในระบบ</p>';
                return;
            }

            allPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            
            allPosts.forEach(post => {
                const postComments = userComments.filter(comment => comment.postId == post.id);
                const postElement = document.createElement('div');
                postElement.className = 'post-summary';
                postElement.classList.add(post.source === 'API Test' ? 'post-from-api' : 'post-from-web');
                
                const formattedDate = formatDate(post.createdAt);
                
                // BUG 2 (Security - Stored XSS): แสดงผล content ด้วย innerHTML
                postElement.innerHTML = `
                    <div class="post-header">
                        <span class="post-author">${escapeHtml(post.author)}</span>
                        <span class="post-timestamp">${formattedDate}</span>
                        <span class="post-source">[Source: ${post.source}]</span>
                    </div>
                    <div class="post-content-body">
                        <h2>${escapeHtml(post.title)}</h2>
                        <div>${post.content}</div>
                    </div>
                    <div class="post-footer">
                        <div class="post-interaction">
                            <button onclick="likePost('${post.id}', this, '${post.source}')">❤️ ${post.likes || 0}</button>
                        </div>
                        <a href="#" class="reply-link" onclick="toggleReplyForm('${post.id}'); return false;">ตอบกลับ (${postComments.length})</a>
                    </div>
                    <div class="comment-section" id="comment-section-${post.id}">
                        <div class="comment-list" id="comment-list-${post.id}"></div>
                        <div id="reply-form-${post.id}" class="reply-form" style="display:none;">
                            <textarea id="reply-textarea-${post.id}" placeholder="แสดงความคิดเห็น..."></textarea>
                            <button onclick="submitReply('${post.id}')">ส่งความคิดเห็น</button>
                        </div>
                    </div>
                `;
                postContainer.appendChild(postElement);
                renderComments(post.id, postComments);
            });
        }).catch(error => {
            console.error("Fetch Error:", error);
            postContainer.innerHTML = '<p style="color: red;">เกิดข้อผิดพลาดในการโหลดข้อมูล! กรุณาตรวจสอบว่า JSON Server ทั้งสอง (Port 3000 และ 3001) ทำงานถูกต้อง</p>';
        });
    }
});

// --- Render Comments Function ---
function renderComments(postId, comments) {
    const commentListElement = document.getElementById(`comment-list-${postId}`);
    commentListElement.innerHTML = '';
    
    comments.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    comments.forEach(comment => {
        const commentElement = document.createElement('div');
        commentElement.className = 'comment';
        const formattedDate = formatDate(comment.createdAt);
        commentElement.innerHTML = `
            <div class="comment-header">
                <strong class="comment-author">${escapeHtml(comment.author)}</strong>
                <span class="comment-timestamp">${formattedDate}</span>
            </div>
            <p class="comment-content">${escapeHtml(comment.content)}</p>
        `;
        commentListElement.appendChild(commentElement);
    });
}

// --- Interaction Logic ---
// BUG 4 (Logic - Race Condition): ฟังก์ชันกดหัวใจยังคงมีบั๊ก
function likePost(postId, buttonElement, source) {
    const targetApiUrl = (source === 'API Test') ? API_URL_POSTMAN : API_URL_USER;
    const currentLikesText = buttonElement.textContent.trim().split(' ')[1];
    const currentLikes = parseInt(currentLikesText) || 0;
    const newLikes = currentLikes + 1;

    fetch(`${targetApiUrl}/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ likes: newLikes }),
    })
    .then(response => response.json())
    .then(updatedPost => {
        buttonElement.innerHTML = `❤️ ${updatedPost.likes}`;
    })
    .catch(error => console.error('Error liking post:', error));
}

function toggleReplyForm(postId) {
    const replyForm = document.getElementById(`reply-form-${postId}`);
    replyForm.style.display = (replyForm.style.display === 'none') ? 'block' : 'none';
}

function submitReply(postId) {
    const textarea = document.getElementById(`reply-textarea-${postId}`);
    const content = textarea.value.trim();

    if (!content) {
        alert('กรุณาพิมพ์ความคิดเห็นก่อนส่ง');
        return;
    }

    const newComment = {
        postId: postId,
        author: localStorage.getItem('kratu_pian_user') || "Anonymous",
        content: content,
        createdAt: new Date().toISOString()
    };

    fetch(`${API_URL_USER}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newComment)
    })
    .then(response => response.json())
    .then(savedComment => {
        textarea.value = '';
        toggleReplyForm(postId);
        fetch(`${API_URL_USER}/comments?postId=${postId}`)
            .then(res => res.json())
            .then(comments => {
                renderComments(postId, comments);
                const replyLink = document.querySelector(`#comment-section-${postId}`).previousElementSibling;
                if(replyLink.classList.contains('reply-link')){
                    replyLink.textContent = `ตอบกลับ (${comments.length})`;
                }
            });
    })
    .catch(error => {
        console.error('Error submitting reply:', error);
        alert('เกิดข้อผิดพลาดในการส่งคอมเมนต์!');
    });
}

// --- Helper Functions ---
function formatDate(dateString) {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        return `${date.getDate()} ${date.toLocaleString('th-TH', { month: 'long' })} ${date.getFullYear() + 543} เวลา ${date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`;
    } catch (e) {
        return '';
    }
}

function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') {
        return '';
    }
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}