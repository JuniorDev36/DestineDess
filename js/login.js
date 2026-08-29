// login.js
// Handles the Login form for Destiny Dess Driving School, wired to Clerk.

import { getClerk } from './clerk-client.js';

// ---------------------------------------------------------------------------
// DOM references (looked up once, no repeated lookups)
// ---------------------------------------------------------------------------
const loginForm = document.getElementById('loginForm');
const loginButton = document.getElementById('loginButton');
const loginError = document.getElementById('loginError');
const loginSuccess = document.getElementById('loginSuccess');

const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------------------------------------------------------------------------
// Message helpers
// ---------------------------------------------------------------------------
function showError(message) {
    loginError.textContent = message;
    loginError.style.display = 'block';
}

function clearError() {
    loginError.textContent = '';
    loginError.style.display = 'none';
}

function showSuccess(message) {
    loginSuccess.textContent = message;
    loginSuccess.style.display = 'block';
}

function clearSuccess() {
    loginSuccess.textContent = '';
    loginSuccess.style.display = 'none';
}

// ---------------------------------------------------------------------------
// Password visibility toggle
// Exposed on window because the toggle button in login.html calls it via
// an inline onclick attribute.
// ---------------------------------------------------------------------------
function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    const icon = btn.querySelector('.material-symbols-outlined');
    if (input.type === 'password') {
        input.type = 'text';
        icon.innerText = 'visibility_off';
    } else {
        input.type = 'password';
        icon.innerText = 'visibility';
    }
}
window.togglePassword = togglePassword;

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------
function validateEmail(value) {
    return EMAIL_REGEX.test(value.trim());
}

// ---------------------------------------------------------------------------
// Button UX
// ---------------------------------------------------------------------------
function setButtonLoading(isLoading) {
    loginButton.disabled = isLoading;
    loginButton.style.opacity = isLoading ? '0.6' : '';
    loginButton.style.cursor = isLoading ? 'not-allowed' : '';

    const label = loginButton.querySelector('span:not(.material-symbols-outlined)');
    if (label) {
        label.textContent = isLoading ? 'Logging in...' : 'Login';
    }
}

// ---------------------------------------------------------------------------
// If the user is already signed in, skip the form entirely.
// ---------------------------------------------------------------------------
async function redirectIfAlreadySignedIn() {
    try {
        const clerk = await getClerk();
        if (clerk.user) {
            window.location.href = 'student-portal.html';
        }
    } catch {
        // Clerk failed to load or the user isn't signed in — stay on this page.
    }
}
redirectIfAlreadySignedIn();

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------

// Clear error/success messaging as soon as the user starts correcting a field
[emailInput, passwordInput].forEach((field) => {
    field.addEventListener('input', () => {
        clearError();
        clearSuccess();
    });
});

loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    clearError();
    clearSuccess();

    // Email validation
    if (!validateEmail(emailInput.value)) {
        showError('Please enter a valid email address.');
        return;
    }

    // Password presence validation
    if (!passwordInput.value) {
        showError('Please enter your password.');
        return;
    }

    setButtonLoading(true);

    try {
        const clerk = await getClerk();

        // Sign In
        const signIn = await clerk.client.signIn.create({
            identifier: emailInput.value.trim(),
            password: passwordInput.value,
        });

        if (signIn.status === 'complete') {
            // Create Session
            await clerk.setActive({ session: signIn.createdSessionId });

            showSuccess('Login successful. Redirecting...');

            // Redirect to student-portal.html
            window.location.href = 'student-portal.html';
        } else {
            // Clerk is asking for an additional step (e.g. 2FA) that this
            // simple form doesn't support yet.
            showError('Additional verification is required for this account. Please contact support.');
        }
    } catch (err) {
        const message = err?.errors?.[0]?.longMessage || err?.message || 'Invalid email or password. Please try again.';
        showError(message);
    } finally {
        setButtonLoading(false);
    }
});
