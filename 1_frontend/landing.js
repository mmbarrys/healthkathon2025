// File: 1_frontend/landing.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM ELEMENTS ---
    const heroSection = document.getElementById('heroSection');
    const loginSection = document.getElementById('loginSection');
    const enterButton = document.getElementById('enterButton');
    const backButton = document.getElementById('backButton');
    const loginCard = document.getElementById('loginCard');
    
    const loginForm = document.getElementById('loginForm');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginError = document.getElementById('loginError');
    const loginSubmitBtn = document.getElementById('loginSubmitBtn');
    const loginSpinner = document.getElementById('loginSpinner');
    const togglePasswordBtn = document.getElementById('togglePassword');

    // --- MOCK DATABASE ---
    const USERS = {
        '123456': { password: 'user123', role: 'user', redirect: 'dashboard.html' },
        'admin': { password: 'admin', role: 'admin', redirect: 'admin.html' }
    };

    // --- TRANSITIONS ---
    
    // Masuk ke Login
    enterButton.addEventListener('click', () => {
        heroSection.classList.add('opacity-0', 'scale-95', 'pointer-events-none'); // Fade out Hero
        setTimeout(() => {
            heroSection.style.display = 'none';
            loginSection.classList.remove('hidden');
            // Trigger reflow
            void loginSection.offsetWidth;
            
            loginSection.classList.remove('opacity-0');
            loginCard.classList.remove('scale-95');
            loginCard.classList.add('scale-100');
            
            usernameInput.focus();
        }, 300);
    });

    // Kembali ke Hero
    backButton.addEventListener('click', () => {
        loginSection.classList.add('opacity-0');
        loginCard.classList.remove('scale-100');
        loginCard.classList.add('scale-95');
        
        setTimeout(() => {
            loginSection.classList.add('hidden');
            heroSection.style.display = 'flex';
            // Trigger reflow
            void heroSection.offsetWidth;
            
            heroSection.classList.remove('opacity-0', 'scale-95', 'pointer-events-none');
            loginError.classList.add('hidden');
            loginForm.reset();
        }, 300);
    });

    // Toggle Password Visibility
    togglePasswordBtn.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        
        // Update icon (menggunakan lucide API atau class replace manual)
        const icon = togglePasswordBtn.querySelector('i'); // atau svg
        // Simple logic: kita biarkan user tahu dari teks inputnya saja, atau swap icon class jika mau
        // Untuk kesederhanaan dengan Lucide script tag:
        // lucide.createIcons() akan me-render ulang jika kita ubah data-lucide, tapi lebih mudah biarkan saja.
    });

    // --- AUTHENTICATION LOGIC ---

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Reset State
        loginError.classList.add('hidden');
        loginSubmitBtn.disabled = true;
        loginSubmitBtn.classList.add('opacity-75', 'cursor-not-allowed');
        loginSpinner.classList.remove('hidden');

        const u = usernameInput.value.trim();
        const p = passwordInput.value.trim();

        // Simulate Network Delay (800ms) agar terasa "real"
        setTimeout(() => {
            const account = USERS[u];

            if (account && account.password === p) {
                // SUCCESS
                console.log(`[AUTH] Login Success: ${account.role}`);
                sessionStorage.setItem('currentUser', u);
                sessionStorage.setItem('currentRole', account.role);
                
                // Redirect
                window.location.href = account.redirect;
            } else {
                // FAILED
                loginError.classList.remove('hidden');
                loginCard.classList.add('animate-pulse'); // Shake effect simple
                setTimeout(() => loginCard.classList.remove('animate-pulse'), 500);
                
                // Reset Button
                loginSubmitBtn.disabled = false;
                loginSubmitBtn.classList.remove('opacity-75', 'cursor-not-allowed');
                loginSpinner.classList.add('hidden');
            }
        }, 800);
    });
});