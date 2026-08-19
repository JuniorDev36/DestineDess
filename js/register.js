// register.js
// Handles the Sign Up form for Destiny Dess Driving School, wired to Clerk.

import { getClerk } from './clerk-client.js';
import { getSupabase } from './supabase-client.js';

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

const verificationStep = document.getElementById('verificationStep');
const verificationCodeInput = document.getElementById('verificationCode');
const verificationError = document.getElementById('verificationError');
const verifyButton = document.getElementById('verifyButton');
const resendCodeBtn = document.getElementById('resendCodeBtn');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STRENGTH_LABELS = {
    weak: 'Weak 🔴',
    medium: 'Medium 🟡',
    strong: 'Strong 🟢',
};

// Holds the in-progress Clerk SignUp resource between the initial submit
// and the verification step.
let pendingSignUp = null;

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

function showVerificationError(message) {
    verificationError.textContent = message;
    verificationError.style.display = 'block';
}

function clearVerificationError() {
    verificationError.textContent = '';
    verificationError.style.display = 'none';
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

// Clerk's create() call wants firstName/lastName rather than one field.
function splitFullName(fullName) {
    const parts = fullName.trim().split(/\s+/);
    const firstName = parts.shift() || '';
    const lastName = parts.join(' ');
    return { firstName, lastName };
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

function setButtonLoading(button, isLoading, loadingText, defaultText) {
    button.disabled = isLoading;
    button.style.opacity = isLoading ? '0.6' : '';
    button.style.cursor = isLoading ? 'not-allowed' : '';

    const label = button.querySelector('span:not(.material-symbols-outlined)');
    if (label) {
        label.textContent = isLoading ? loadingText : defaultText;
    }
}

function showVerificationStep() {
    signupForm.style.display = 'none';
    clearError();
    clearSuccess();
    verificationStep.style.display = 'block';
    verificationCodeInput.focus();
}

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------

// Live password strength indicator
passwordInput.addEventListener('input', updatePasswordStrength);

// Live password mismatch detection
confirmPasswordInput.addEventListener('input', updatePasswordMismatch);

// Clear error/success messaging as soon as the user starts correcting a field
[fullNameInput, emailInput, passwordInput, confirmPasswordInput].forEach((field) => {
    field.addEventListener('input', () => {
        clearError();
        clearSuccess();
    });
});

verificationCodeInput.addEventListener('input', clearVerificationError);

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

    setButtonLoading(signupButton, true, 'Creating Account...', 'Create Account');

    try {
        const clerk = await getClerk();
        const { firstName, lastName } = splitFullName(fullNameInput.value);

        // Create Sign Up
        pendingSignUp = await clerk.client.signUp.create({
            firstName,
            lastName,
            emailAddress: emailInput.value.trim(),
            password: passwordInput.value,
        });

        // Email Verification
        await pendingSignUp.prepareEmailAddressVerification({ strategy: 'email_code' });

        showVerificationStep();
    } catch (err) {
        const message = err?.errors?.[0]?.longMessage || err?.message || 'Something went wrong. Please try again.';
        showError(message);
    } finally {
        setButtonLoading(signupButton, false, 'Creating Account...', 'Create Account');
    }
});

verifyButton.addEventListener('click', async function () {
    clearVerificationError();

    const code = verificationCodeInput.value.trim();
    if (!code) {
        showVerificationError('Please enter the verification code.');
        return;
    }

    if (!pendingSignUp) {
        showVerificationError('Your sign-up session expired. Please start again.');
        return;
    }

    setButtonLoading(verifyButton, true, 'Verifying...', 'Verify Email');

    try {
        const clerk = await getClerk();
        const result = await pendingSignUp.attemptEmailAddressVerification({ code });

        if (result.status === 'complete') {
            // Create Session
            await clerk.setActive({ session: result.createdSessionId });

            // Create the student's profile row in Supabase. This is
            // best-effort — if it fails, student-portal.js will retry
            // creating the row the next time the dashboard loads, so a
            // hiccup here doesn't block the student from reaching the
            // portal.
            try {
                // Create student profile in Supabase
                const supabase = getSupabase();

                const { data, error } = await supabase
                    .from('student_profiles')
                    .upsert(
                        {
                            clerk_user_id: clerk.user.id,
                            full_name: fullNameInput.value.trim(),
                            email: emailInput.value.trim(),
                        },
                        {
                            onConflict: 'clerk_user_id',
                        }
                    );

                console.log('Supabase response:', data);
                console.log('Supabase error:', error);
            } catch (supabaseErr) {
                console.error('Supabase student profile creation failed:', supabaseErr);
            }

            // Redirect to student-portal.html
            window.location.href = 'student-portal.html';
        } else {
            showVerificationError('That code didn\'t work. Please check it and try again.');
        }
    } catch (err) {
        const message = err?.errors?.[0]?.longMessage || err?.message || 'Verification failed. Please try again.';
        showVerificationError(message);
    } finally {
        setButtonLoading(verifyButton, false, 'Verifying...', 'Verify Email');
    }
}   );

resendCodeBtn.addEventListener('click', async function () {
    if (!pendingSignUp) {
        showVerificationError('Your sign-up session expired. Please start again.');
        return;
    }

    clearVerificationError();
    setButtonLoading(resendCodeBtn, true, 'Sending...', 'Resend code');

    try {
        await pendingSignUp.prepareEmailAddressVerification({ strategy: 'email_code' });
    } catch (err) {
        const message = err?.errors?.[0]?.longMessage || err?.message || 'Could not resend the code. Please try again.';
        showVerificationError(message);
    } finally {
        setButtonLoading(resendCodeBtn, false, 'Sending...', 'Resend code');
    }
});
