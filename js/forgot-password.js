// forgot-password.js
// Handles the Forgot Password form for Destiny Dess Driving School, wired
// to Clerk's reset_password_email_code flow.

import { getClerk } from './clerk-client.js';

// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------
const forgotPasswordForm = document.getElementById('forgotPasswordForm');
const forgotPasswordButton = document.getElementById('forgotPasswordButton');
const forgotPasswordError = document.getElementById('forgotPasswordError');
const forgotPasswordSuccess = document.getElementById('forgotPasswordSuccess');
const emailInput = document.getElementById('email');

const resetStep = document.getElementById('resetStep');
const resetCodeInput = document.getElementById('resetCode');
const newPasswordInput = document.getElementById('newPassword');
const resetError = document.getElementById('resetError');
const resetButton = document.getElementById('resetButton');
const resendResetCodeBtn = document.getElementById('resendResetCodeBtn');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Holds the in-progress Clerk SignIn resource between requesting the code
// and completing the reset.
let pendingSignIn = null;

// ---------------------------------------------------------------------------
// Message helpers
// ---------------------------------------------------------------------------
function showError(message) {
    forgotPasswordError.textContent = message;
    forgotPasswordError.style.display = 'block';
}

function clearError() {
    forgotPasswordError.textContent = '';
    forgotPasswordError.style.display = 'none';
}

function showSuccess(message) {
    forgotPasswordSuccess.textContent = message;
    forgotPasswordSuccess.style.display = 'block';
}

function clearSuccess() {
    forgotPasswordSuccess.textContent = '';
    forgotPasswordSuccess.style.display = 'none';
}

function showResetError(message) {
    resetError.textContent = message;
    resetError.style.display = 'block';
}

function clearResetError() {
    resetError.textContent = '';
    resetError.style.display = 'none';
}

// ---------------------------------------------------------------------------
// Password visibility toggle
// Exposed on window because the toggle button in forgot-password.html calls
// it via an inline onclick attribute.
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
function setButtonLoading(button, isLoading, loadingText, defaultText) {
    button.disabled = isLoading;
    button.style.opacity = isLoading ? '0.6' : '';
    button.style.cursor = isLoading ? 'not-allowed' : '';

    const label = button.querySelector('span:not(.material-symbols-outlined)');
    if (label) {
        label.textContent = isLoading ? loadingText : defaultText;
    }
}

function showResetStep() {
    forgotPasswordForm.style.display = 'none';
    clearError();
    clearSuccess();
    resetStep.style.display = 'block';
    resetCodeInput.focus();
}

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------
emailInput.addEventListener('input', () => {
    clearError();
    clearSuccess();
});

resetCodeInput.addEventListener('input', clearResetError);
newPasswordInput.addEventListener('input', clearResetError);

forgotPasswordForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    clearError();
    clearSuccess();

    // Email validation
    if (!validateEmail(emailInput.value)) {
        showError('Please enter a valid email address.');
        return;
    }

    setButtonLoading(forgotPasswordButton, true, 'Sending...', 'Send Reset Link');

    try {
        const clerk = await getClerk();

        // Request Password Reset
        pendingSignIn = await clerk.client.signIn.create({
            identifier: emailInput.value.trim(),
            strategy: 'reset_password_email_code',
        });

        showResetStep();
    } catch (err) {
        // Always show a generic success message, regardless of whether the
        // email is registered, so this form can't be used to check which
        // emails have accounts.
        showSuccess("If an account exists for that email, we've sent a reset code.");
        forgotPasswordForm.reset();
    } finally {
        setButtonLoading(forgotPasswordButton, false, 'Sending...', 'Send Reset Link');
    }
});

resetButton.addEventListener('click', async function () {
    clearResetError();

    const code = resetCodeInput.value.trim();
    const newPassword = newPasswordInput.value;

    if (!code) {
        showResetError('Please enter the verification code.');
        return;
    }

    if (!newPassword || newPassword.length < 8) {
        showResetError('Please enter a new password of at least 8 characters.');
        return;
    }

    if (!pendingSignIn) {
        showResetError('Your reset session expired. Please start again.');
        return;
    }

    setButtonLoading(resetButton, true, 'Resetting...', 'Reset Password');

    try {
        const clerk = await getClerk();
        const result = await pendingSignIn.attemptFirstFactor({
            strategy: 'reset_password_email_code',
            code,
            password: newPassword,
        });

        if (result.status === 'complete') {
            // Create Session
            await clerk.setActive({ session: result.createdSessionId });

            // Redirect to student-portal.html
            window.location.href = 'student-portal.html';
        } else {
            showResetError('That code didn\'t work. Please check it and try again.');
        }
    } catch (err) {
        const message = err?.errors?.[0]?.longMessage || err?.message || 'Reset failed. Please try again.';
        showResetError(message);
    } finally {
        setButtonLoading(resetButton, false, 'Resetting...', 'Reset Password');
    }
});

resendResetCodeBtn.addEventListener('click', async function () {
    if (!pendingSignIn) {
        showResetError('Your reset session expired. Please start again.');
        return;
    }

    clearResetError();
    setButtonLoading(resendResetCodeBtn, true, 'Sending...', 'Resend code');

    try {
        await pendingSignIn.prepareFirstFactor({
            strategy: 'reset_password_email_code',
            emailAddressId: pendingSignIn.supportedFirstFactors?.find(
                (factor) => factor.strategy === 'reset_password_email_code'
            )?.emailAddressId,
        });
    } catch (err) {
        const message = err?.errors?.[0]?.longMessage || err?.message || 'Could not resend the code. Please try again.';
        showResetError(message);
    } finally {
        setButtonLoading(resendResetCodeBtn, false, 'Sending...', 'Resend code');
    }
});
