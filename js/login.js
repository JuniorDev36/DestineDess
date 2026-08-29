// login.js
// Handles the Login form for Destiny Dess Driving School, wired to Clerk.

import { getClerk } from './clerk-client.js';

// ---------------------------------------------------------------------------
// DOM references
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

    const label = loginButton.querySelector(
        'span:not(.material-symbols-outlined)'
    );

    if (label) {
        label.textContent = isLoading ? 'Logging in...' : 'Login';
    }
}

// ---------------------------------------------------------------------------
// Redirect based on Clerk role
// ---------------------------------------------------------------------------
// Admins go to admin-dashboard.html.
// Students go to student-portal.html.
// Any account without the admin role is treated as a student.
// ---------------------------------------------------------------------------

function redirectByRole(clerkUser) {
    const role = clerkUser?.publicMetadata?.role;

    console.log('[login] Authenticated user role:', role);

    if (role === 'admin') {
        window.location.href = 'admin-dashboard.html';
        return;
    }

    window.location.href = 'student-portal.html';
}

// ---------------------------------------------------------------------------
// If the user is already signed in, send them to the correct portal.
// ---------------------------------------------------------------------------

async function redirectIfAlreadySignedIn() {
    try {
        const clerk = await getClerk();

        if (clerk.user) {
            redirectByRole(clerk.user);
        }
    } catch (error) {
        console.error('[login] Failed to check existing session:', error);

        // If Clerk fails to load or there is no usable session,
        // remain on the login page.
    }
}

redirectIfAlreadySignedIn();

// ---------------------------------------------------------------------------
// Clear messages when the user edits the form
// ---------------------------------------------------------------------------

[emailInput, passwordInput].forEach((field) => {
    field.addEventListener('input', () => {
        clearError();
        clearSuccess();
    });
});

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    clearError();
    clearSuccess();

    // Email validation
    if (!validateEmail(emailInput.value)) {
        showError('Please enter a valid email address.');
        return;
    }

    // Password validation
    if (!passwordInput.value) {
        showError('Please enter your password.');
        return;
    }

    setButtonLoading(true);

    try {
        const clerk = await getClerk();

        // ---------------------------------------------------------------
        // Create Clerk sign-in
        // ---------------------------------------------------------------

        const signIn = await clerk.client.signIn.create({
            identifier: emailInput.value.trim(),
            password: passwordInput.value,
        });

        // ---------------------------------------------------------------
        // Login completed
        // ---------------------------------------------------------------

        if (signIn.status === 'complete') {
            await clerk.setActive({
                session: signIn.createdSessionId,
            });

            showSuccess('Login successful. Redirecting...');

            // -----------------------------------------------------------
            // IMPORTANT:
            // After activating the session, read the authenticated Clerk
            // user so we can determine whether this is an admin or student.
            // -----------------------------------------------------------

            await clerk.user.reload();

            redirectByRole(clerk.user);

            return;
        }

        // ---------------------------------------------------------------
        // Additional verification required
        // ---------------------------------------------------------------

        showError(
            'Additional verification is required for this account. Please contact support.'
        );

    } catch (err) {
        console.error('[login] Sign-in failed:', err);

        const message =
            err?.errors?.[0]?.longMessage ||
            err?.message ||
            'Invalid email or password. Please try again.';

        showError(message);
    } finally {
        setButtonLoading(false);
    }
});