// register.js
// Handles the Sign Up form for Destiny Dess Driving School.
// Clerk authentication is NOT implemented yet — this file validates the
// form client-side and leaves clearly marked placeholders so Clerk can be
// dropped in with minimal changes.

// ---------------------------------------------------------------------------
// DOM references (looked up once, no repeated lookups)
// ---------------------------------------------------------------------------
const signupForm = document.getElementById('signupForm');
const signupButton = document.getElementById('signupButton');
const signupError = document.getElementById('signupError');
const signupSuccess = document.getElementById('signupSuccess');

const fullNameInput = document.getElementById('fullName');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirmPassword');
const passwordMismatch = document.getElementById('passwordMismatch');
const passwordStrength = document.getElementById('passwordStrength');
const termsCheckbox = document.getElementById('terms');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STRENGTH_LABELS = {
    weak: 'Weak 🔴',
    medium: 'Medium 🟡',
    strong: 'Strong 🟢',
};

// ---------------------------------------------------------------------------
// Message helpers
// ---------------------------------------------------------------------------
function showError(message) {
    signupError.textContent = message;
    signupError.style.display = 'block';
}

function clearError() {
    signupError.textContent = '';
    signupError.style.display = 'none';
}

function showSuccess(message) {
    signupSuccess.textContent = message;
    signupSuccess.style.display = 'block';
}

function clearSuccess() {
    signupSuccess.textContent = '';
    signupSuccess.style.display = 'none';
}

// ---------------------------------------------------------------------------
// Password visibility toggle
// Exposed on window because the toggle buttons in register.html call it via
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
function validateName(value) {
    return value.trim().length >= 2;
}

function validateEmail(value) {
    return EMAIL_REGEX.test(value.trim());
}

function getPasswordStrength(value) {
    if (value.length < 8) {
        return 'weak';
    }

    const hasUpper = /[A-Z]/.test(value);
    const hasLower = /[a-z]/.test(value);
    const hasNumber = /[0-9]/.test(value);
    const hasSpecial = /[^A-Za-z0-9]/.test(value);

    if (hasUpper && hasLower && hasNumber && hasSpecial) {
        return 'strong';
    }

    if (hasNumber && /[A-Za-z]/.test(value)) {
        return 'medium';
    }

    return 'weak';
}

function passwordsMatch() {
    return passwordInput.value === confirmPasswordInput.value;
}

// ---------------------------------------------------------------------------
// Live UI updates
// ---------------------------------------------------------------------------
function updatePasswordStrength() {
    const value = passwordInput.value;

    if (!value) {
        passwordStrength.style.display = 'none';
        passwordStrength.textContent = '';
        return;
    }

    const strength = getPasswordStrength(value);
    passwordStrength.textContent = STRENGTH_LABELS[strength];
    passwordStrength.style.display = 'block';
}

function updatePasswordMismatch() {
    if (confirmPasswordInput.value && !passwordsMatch()) {
        passwordMismatch.style.display = 'block';
        confirmPasswordInput.classList.add('border-error');
    } else {
        passwordMismatch.style.display = 'none';
        confirmPasswordInput.classList.remove('border-error');
    }
}

function setButtonLoading(isLoading) {
    signupButton.disabled = isLoading;
    signupButton.style.opacity = isLoading ? '0.6' : '';
    signupButton.style.cursor = isLoading ? 'not-allowed' : '';

    const label = signupButton.querySelector('span:not(.material-symbols-outlined)');
    if (label) {
        label.textContent = isLoading ? 'Creating Account...' : 'Create Account';
    }
}

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------

// Live password strength indicator
passwordInput.addEventListener('input', updatePasswordStrength);

// Live password mismatch detection (existing behavior, preserved)
confirmPasswordInput.addEventListener('input', updatePasswordMismatch);

// Clear error/success messaging as soon as the user starts correcting a field
[fullNameInput, emailInput, passwordInput, confirmPasswordInput].forEach((field) => {
    field.addEventListener('input', () => {
        clearError();
        clearSuccess();
    });
});

signupForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    clearError();
    clearSuccess();

    // Full Name validation
    if (!validateName(fullNameInput.value)) {
        showError('Please enter your full name.');
        return;
    }

    // Email validation
    if (!validateEmail(emailInput.value)) {
        showError('Please enter a valid email address.');
        return;
    }

    // Password match validation
    if (!passwordsMatch()) {
        updatePasswordMismatch();
        return;
    }

    // Terms acceptance validation
    if (!termsCheckbox.checked) {
        showError('You must agree to the Terms and Conditions and Privacy Policy.');
        return;
    }

    setButtonLoading(true);

    try {
        // Create Sign Up
        // TODO: Call Clerk's signUp.create() with fullNameInput.value,
        // emailInput.value, and passwordInput.value once Clerk is integrated.

        // Email Verification
        // TODO: Trigger Clerk's email verification flow (e.g.
        // signUp.prepareEmailAddressVerification()) and handle the
        // verification code step if required.

        // Create Session
        // TODO: Once verification succeeds, activate the Clerk session
        // (e.g. setActive({ session: signUp.createdSessionId })).

        // Redirect to student-portal.html
        // TODO: window.location.href = "student-portal.html";

    } catch (err) {
        showError(err?.message || 'Something went wrong. Please try again.');
    } finally {
        setButtonLoading(false);
    }
});
