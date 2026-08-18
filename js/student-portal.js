// student-portal.js
// Protects the Student Portal behind a real Clerk session, and populates
// every dashboard section with real data from Supabase.

import { getClerk } from './clerk-client.js';
import { getSupabase } from './supabase-client.js';

// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------
const userInitials = document.getElementById('userInitials');
const userAvatar = document.getElementById('userAvatar');
const userName = document.getElementById('userName');
const dashboardGreeting = document.getElementById('dashboardGreeting');

const registrationStatusBadge = document.getElementById('registrationStatusBadge');
const registrationStatusText = document.getElementById('registrationStatusText');
const dashboardPackage = document.getElementById('dashboardPackage');
const dashboardNextLesson = document.getElementById('dashboardNextLesson');
const dashboardInstructor = document.getElementById('dashboardInstructor');
const dashboardLessonType = document.getElementById('dashboardLessonType');

const progressLabel = document.getElementById('progressLabel');
const progressFill = document.getElementById('progressFill');
const theoryProgressLabel = document.getElementById('theoryProgressLabel');
const theoryProgressFill = document.getElementById('theoryProgressFill');
const practicalProgressLabel = document.getElementById('practicalProgressLabel');
const practicalProgressFill = document.getElementById('practicalProgressFill');
const moduleList = document.getElementById('moduleList');
const notificationsList = document.getElementById('notificationsList');
const contactInstructorBtn = document.getElementById('contactInstructorBtn');

const profileFullName = document.getElementById('profileFullName');
const profileEmail = document.getElementById('profileEmail');
const profilePhone = document.getElementById('profilePhone');
const profileDob = document.getElementById('profileDob');
const profileAddress = document.getElementById('profileAddress');
const profileInfoDisplay = document.getElementById('profileInfoDisplay');
const profileEditForm = document.getElementById('profileEditForm');
const editFullNameInput = document.getElementById('editFullNameInput');
const editPhoneInput = document.getElementById('editPhoneInput');
const editDobInput = document.getElementById('editDobInput');
const editAddressInput = document.getElementById('editAddressInput');
const editProfileError = document.getElementById('editProfileError');
const editProfileSuccess = document.getElementById('editProfileSuccess');
const saveProfileBtn = document.getElementById('saveProfileBtn');
const cancelEditProfileBtn = document.getElementById('cancelEditProfileBtn');

const registrationStatus = document.getElementById('registrationStatus');
const registrationPackage = document.getElementById('registrationPackage');
const registrationDate = document.getElementById('registrationDate');
const registrationNotes = document.getElementById('registrationNotes');

const registrationForm = document.getElementById('registrationForm');
const registrationInfo = document.getElementById('registrationInfo');
const packageOptions = document.getElementById('packageOptions');
const regPhoneInput = document.getElementById('regPhoneInput');
const regDobInput = document.getElementById('regDobInput');
const regAddressInput = document.getElementById('regAddressInput');
const registrationFormError = document.getElementById('registrationFormError');
const registrationFormSuccess = document.getElementById('registrationFormSuccess');
const submitRegistrationBtn = document.getElementById('submitRegistrationBtn');

let selectedPackageId = null;

const upcomingLessonsTableBody = document.getElementById('upcomingLessonsTableBody');
const reqLessonDate = document.getElementById('reqLessonDate');
const reqLessonTime = document.getElementById('reqLessonTime');
const reqLessonType = document.getElementById('reqLessonType');
const requestLessonError = document.getElementById('requestLessonError');
const requestLessonSuccess = document.getElementById('requestLessonSuccess');
const requestLessonBtn = document.getElementById('requestLessonBtn');
const completedLessonsTableBody = document.getElementById('completedLessonsTableBody');
const announcementsList = document.getElementById('announcementsList');

const editProfileBtn = document.getElementById('editProfileBtn');
const updatePasswordBtn = document.getElementById('updatePasswordBtn');
const currentPasswordInput = document.getElementById('currentPasswordInput');
const newPasswordInput = document.getElementById('newPasswordInput');
const logoutBtn = document.getElementById('logoutBtn');
const portalMenuToggle = document.getElementById('portalMenuToggle');
const portalNavLinks = document.getElementById('portalNavLinks');

let currentClerkUser = null;
let currentProfile = null;
let currentInstructorEmail = null;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function getInitials(fullName) {
    if (!fullName) return '?';
    return fullName
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || '')
        .join('');
}

function formatDate(dateInput) {
    if (!dateInput) return '—';
    const date = new Date(dateInput);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function setText(el, value, fallback = '—') {
    if (!el) return;
    el.textContent = value ?? fallback;
}

function logLoadError(section, error) {
    console.error(`[student-portal] Failed to load ${section}:`, error);
}

// ---------------------------------------------------------------------------
// Route protection — the real guard. No Clerk session, no portal.
// ---------------------------------------------------------------------------
async function requireSession() {
    const clerk = await getClerk();

    if (!clerk.user) {
        window.location.href = 'login.html';
        return null;
    }

    // Admins don't belong on the student portal — send them to their own
    // dashboard instead, without ever showing them this page's content.
    if (clerk.user.publicMetadata?.role === 'admin') {
        window.location.href = 'admin-dashboard.html';
        return null;
    }

    document.body.style.display = '';
    return clerk;
}

// ---------------------------------------------------------------------------
// Student profile — Clerk for identity, Supabase for the extra fields
// (date of birth, address) that Clerk doesn't store.
// ---------------------------------------------------------------------------
async function ensureProfile(clerkUser) {
    const supabase = getSupabase();

    const { data: existing, error: fetchError } = await supabase
        .from('student_profiles')
        .select('*')
        .eq('clerk_user_id', clerkUser.id)
        .maybeSingle();

    if (fetchError) {
        logLoadError('profile', fetchError);
        return null;
    }

    if (existing) return existing;

    // Safety net: if the profile row wasn't created at sign-up (e.g. an
    // account created before this feature existed, or the insert in
    // register.js failed), create it now.
    const { data: created, error: createError } = await supabase
        .from('student_profiles')
        .upsert(
            {
                clerk_user_id: clerkUser.id,
                full_name: clerkUser.fullName,
                email: clerkUser.primaryEmailAddress?.emailAddress,
            },
            { onConflict: 'clerk_user_id' }
        )
        .select()
        .maybeSingle();

    if (createError) {
        logLoadError('profile creation', createError);
        return null;
    }

    return created;
}

function renderUserProfile(clerkUser, profile) {
    const fullName = clerkUser.fullName || [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ');
    const email = clerkUser.primaryEmailAddress?.emailAddress;
    const phone = profile?.phone || clerkUser.primaryPhoneNumber?.phoneNumber;

    setText(userName, fullName || 'Student');
    setText(dashboardGreeting, `Welcome back${fullName ? `, ${fullName.split(' ')[0]}` : ''}.`);
    setText(profileFullName, fullName);
    setText(profileEmail, email);
    setText(profilePhone, phone);
    setText(profileDob, profile?.date_of_birth ? formatDate(profile.date_of_birth) : null);
    setText(profileAddress, profile?.address);

    if (clerkUser.imageUrl && clerkUser.hasImage) {
        userAvatar.innerHTML = `<img alt="Profile picture" src="${clerkUser.imageUrl}" />`;
    } else {
        userInitials.textContent = getInitials(fullName);
    }
}

// Clerk's user.update() wants firstName/lastName rather than one field.
function splitFullName(fullName) {
    const parts = fullName.trim().split(/\s+/);
    const firstName = parts.shift() || '';
    const lastName = parts.join(' ');
    return { firstName, lastName };
}

function showEditProfileError(message) {
    editProfileError.textContent = message;
    editProfileError.style.display = 'block';
}

function clearEditProfileMessages() {
    editProfileError.textContent = '';
    editProfileError.style.display = 'none';
    editProfileSuccess.textContent = '';
    editProfileSuccess.style.display = 'none';
}

function openProfileEditForm() {
    clearEditProfileMessages();

    const fullName = currentClerkUser?.fullName
        || [currentClerkUser?.firstName, currentClerkUser?.lastName].filter(Boolean).join(' ');

    editFullNameInput.value = fullName || '';
    editPhoneInput.value = currentProfile?.phone || '';
    editDobInput.value = currentProfile?.date_of_birth || '';
    editAddressInput.value = currentProfile?.address || '';

    profileInfoDisplay.style.display = 'none';
    profileEditForm.style.display = 'block';
}

function closeProfileEditForm() {
    profileEditForm.style.display = 'none';
    profileInfoDisplay.style.display = 'grid';
}

async function saveProfileChanges() {
    clearEditProfileMessages();

    const fullName = editFullNameInput.value.trim();
    const phone = editPhoneInput.value.trim();
    const dob = editDobInput.value;
    const address = editAddressInput.value.trim();

    if (fullName.length < 2) {
        showEditProfileError('Please enter your full name.');
        return;
    }

    saveProfileBtn.disabled = true;
    saveProfileBtn.style.opacity = '0.6';

    try {
        const clerk = await getClerk();
        const { firstName, lastName } = splitFullName(fullName);

        await clerk.user.update({ firstName, lastName });

        const supabase = getSupabase();
        const { data: updatedProfile, error } = await supabase
            .from('student_profiles')
            .update({ phone: phone || null, date_of_birth: dob || null, address: address || null })
            .eq('clerk_user_id', currentClerkUser.id)
            .select()
            .maybeSingle();

        if (error) throw error;

        currentProfile = updatedProfile || currentProfile;
        renderUserProfile(clerk.user, currentProfile);
        closeProfileEditForm();
    } catch (err) {
        logLoadError('profile update', err);
        showEditProfileError('Could not save your changes. Please try again.');
    } finally {
        saveProfileBtn.disabled = false;
        saveProfileBtn.style.opacity = '';
    }
}

// ---------------------------------------------------------------------------
// Registration + package
// ---------------------------------------------------------------------------
async function loadRegistration(clerkUserId) {
    const supabase = getSupabase();

    const { data: registration, error } = await supabase
        .from('registrations')
        .select('*, packages(*)')
        .eq('clerk_user_id', clerkUserId)
        .order('registered_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        logLoadError('registration', error);
    }

    if (!registration) {
        setText(registrationStatusText, 'No registration on file');
        registrationStatusBadge.classList.remove('success');
        setText(dashboardPackage, null);

        registrationInfo.style.display = 'none';
        registrationForm.style.display = 'block';
        await loadPackageOptions();

        return null;
    }

    const isActive = registration.status === 'active' || registration.status === 'approved';
    registrationStatusBadge.classList.toggle('success', isActive);
    setText(registrationStatusText, `Registration: ${registration.status}`);

    setText(registrationStatus, registration.status);
    setText(registrationPackage, registration.packages?.name);
    setText(registrationDate, formatDate(registration.registered_at));
    setText(registrationNotes, registration.notes);
    setText(dashboardPackage, registration.packages?.name);

    registrationForm.style.display = 'none';
    registrationInfo.style.display = 'grid';

    return registration;
}

function showRegistrationFormError(message) {
    registrationFormError.textContent = message;
    registrationFormError.style.display = 'block';
}

function clearRegistrationFormError() {
    registrationFormError.textContent = '';
    registrationFormError.style.display = 'none';
}

function showRegistrationFormSuccess(message) {
    registrationFormSuccess.textContent = message;
    registrationFormSuccess.style.display = 'block';
}

async function loadPackageOptions() {
    const supabase = getSupabase();

    const { data: packages, error } = await supabase
        .from('packages')
        .select('*')
        .order('sort_order', { ascending: true });

    if (error) {
        logLoadError('packages', error);
        packageOptions.innerHTML = '<p style="color: var(--color-text-muted); font-size: 14px;">Could not load packages right now. Please try again later.</p>';
        return;
    }

    if (!packages?.length) {
        packageOptions.innerHTML = '<p style="color: var(--color-text-muted); font-size: 14px;">No packages are available yet.</p>';
        return;
    }

    packageOptions.innerHTML = packages
        .map((pkg) => {
            const priceLabel = pkg.price != null ? `P${pkg.price}` : 'Custom pricing';
            return `
                <div class="package-option" data-package-id="${pkg.id}">
                    <h4>${pkg.name}</h4>
                    <div class="package-price">${priceLabel}</div>
                    <p>${pkg.description || ''}</p>
                </div>
            `;
        })
        .join('');

    packageOptions.querySelectorAll('.package-option').forEach((card) => {
        card.addEventListener('click', () => {
            packageOptions.querySelectorAll('.package-option').forEach((c) => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedPackageId = card.dataset.packageId;
            clearRegistrationFormError();
        });
    });
}

async function submitRegistration(clerkUserId) {
    clearRegistrationFormError();

    if (!selectedPackageId) {
        showRegistrationFormError('Please choose a package.');
        return;
    }

    const phone = regPhoneInput.value.trim();
    const dob = regDobInput.value;
    const address = regAddressInput.value.trim();

    if (!phone || !dob || !address) {
        showRegistrationFormError('Please fill in your phone number, date of birth, and address.');
        return;
    }

    submitRegistrationBtn.disabled = true;
    submitRegistrationBtn.style.opacity = '0.6';

    try {
        const supabase = getSupabase();

        const { error: profileError } = await supabase
            .from('student_profiles')
            .update({ phone, date_of_birth: dob, address })
            .eq('clerk_user_id', clerkUserId);

        if (profileError) throw profileError;

        const { error: registrationError } = await supabase
            .from('registrations')
            .insert({
                clerk_user_id: clerkUserId,
                package_id: selectedPackageId,
                status: 'pending',
            });

        if (registrationError) throw registrationError;

        showRegistrationFormSuccess("Registration submitted! We'll confirm once your payment is verified.");
        await loadRegistration(clerkUserId);
    } catch (err) {
        logLoadError('registration submission', err);
        showRegistrationFormError('Something went wrong submitting your registration. Please try again.');
    } finally {
        submitRegistrationBtn.disabled = false;
        submitRegistrationBtn.style.opacity = '';
    }
}

// ---------------------------------------------------------------------------
// Lessons — upcoming and completed, both pulled from one query.
// ---------------------------------------------------------------------------
function renderLessonRow(lesson) {
    const badgeClass = lesson.status === 'completed' ? 'badge success' : 'badge';
    return `
        <tr>
            <td>${formatDate(lesson.lesson_date)}</td>
            <td>${lesson.lesson_time}</td>
            <td>${lesson.lesson_type}</td>
            <td><span class="${badgeClass}">${lesson.status}</span></td>
        </tr>
    `;
}

async function loadLessons(clerkUserId) {
    const supabase = getSupabase();

    const { data: lessons, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('clerk_user_id', clerkUserId)
        .order('lesson_date', { ascending: true });

    if (error) {
        logLoadError('lessons', error);
    }

    const allLessons = lessons || [];
    const upcoming = allLessons.filter((l) => l.status === 'upcoming');
    const completed = allLessons.filter((l) => l.status === 'completed');

    upcomingLessonsTableBody.innerHTML = upcoming.length
        ? upcoming.map(renderLessonRow).join('')
        : '<tr><td colspan="4">You have no upcoming lessons.</td></tr>';

    completedLessonsTableBody.innerHTML = completed.length
        ? completed.map(renderLessonRow).join('')
        : '<tr><td colspan="4">You haven\'t completed any lessons yet.</td></tr>';

    // Dashboard "Next Lesson" summary — soonest upcoming lesson.
    const nextLesson = upcoming[0];
    if (nextLesson) {
        setText(dashboardNextLesson, `${formatDate(nextLesson.lesson_date)}, ${nextLesson.lesson_time}`);
        setText(dashboardInstructor, nextLesson.instructor_name);
        setText(dashboardLessonType, nextLesson.lesson_type);
        currentInstructorEmail = nextLesson.instructor_email || null;
    } else {
        setText(dashboardNextLesson, 'No upcoming lessons');
        setText(dashboardInstructor, null);
        setText(dashboardLessonType, null);
        currentInstructorEmail = null;
    }
}

function showRequestLessonError(message) {
    requestLessonError.textContent = message;
    requestLessonError.style.display = 'block';
}

function clearRequestLessonMessages() {
    requestLessonError.textContent = '';
    requestLessonError.style.display = 'none';
    requestLessonSuccess.textContent = '';
    requestLessonSuccess.style.display = 'none';
}

async function submitLessonRequest(clerkUserId) {
    clearRequestLessonMessages();

    const date = reqLessonDate.value;
    const time = reqLessonTime.value.trim();
    const type = reqLessonType.value.trim();

    if (!date || !time || !type) {
        showRequestLessonError('Please fill in a preferred date, time, and lesson type.');
        return;
    }

    requestLessonBtn.disabled = true;
    requestLessonBtn.style.opacity = '0.6';

    try {
        const supabase = getSupabase();
        const { error } = await supabase.from('lessons').insert({
            clerk_user_id: clerkUserId,
            lesson_date: date,
            lesson_time: time,
            lesson_type: type,
            status: 'upcoming',
        });

        if (error) throw error;

        requestLessonSuccess.textContent = "Lesson requested! We'll confirm it and assign an instructor soon.";
        requestLessonSuccess.style.display = 'block';
        reqLessonDate.value = '';
        reqLessonTime.value = '';
        reqLessonType.value = '';

        await loadLessons(clerkUserId);
    } catch (err) {
        logLoadError('lesson request', err);
        showRequestLessonError('Something went wrong requesting your lesson. Please try again.');
    } finally {
        requestLessonBtn.disabled = false;
        requestLessonBtn.style.opacity = '';
    }
}

// ---------------------------------------------------------------------------
// Course progress + modules
// Theory-related modules only show for students whose package includes
// theory lessons (currently just the Advanced Package).
// ---------------------------------------------------------------------------
async function loadProgress(clerkUserId, registration) {
    const supabase = getSupabase();
    const includesTheory = registration?.packages?.includes_theory ?? false;

    // Prefer modules scoped to this exact package; fall back to the
    // global theory-gated curriculum if the package has none of its own.
    let relevantModules = [];

    if (registration?.package_id) {
        const { data: packageModules, error: packageModulesError } = await supabase
            .from('course_modules')
            .select('id, name, sort_order, category')
            .eq('package_id', registration.package_id)
            .order('sort_order', { ascending: true });

        if (packageModulesError) {
            logLoadError('package modules', packageModulesError);
        }

        relevantModules = packageModules || [];
    }

    if (!relevantModules.length) {
        const { data: globalModules, error: globalModulesError } = await supabase
            .from('course_modules')
            .select('id, name, sort_order, requires_theory, category')
            .is('package_id', null)
            .order('sort_order', { ascending: true });

        if (globalModulesError) {
            logLoadError('global modules', globalModulesError);
        }

        relevantModules = (globalModules || []).filter((m) => !m.requires_theory || includesTheory);
    }

    function resetBar(labelEl, fillEl) {
        labelEl.textContent = 'No modules yet';
        fillEl.style.width = '0%';
    }

    if (!relevantModules.length) {
        resetBar(progressLabel, progressFill);
        resetBar(theoryProgressLabel, theoryProgressFill);
        resetBar(practicalProgressLabel, practicalProgressFill);
        moduleList.innerHTML = '<p style="color: var(--color-text-muted); font-size: 14px;">Your course modules will appear here once your curriculum is set up.</p>';
        return;
    }

    const { data: progressRows, error: progressError } = await supabase
        .from('student_module_progress')
        .select('module_id, status')
        .eq('clerk_user_id', clerkUserId);

    if (progressError) {
        logLoadError('module progress', progressError);
    }

    const progressByModule = new Map((progressRows || []).map((row) => [row.module_id, row.status]));

    const merged = relevantModules.map((module) => ({
        name: module.name,
        status: progressByModule.get(module.id) || 'locked',
        category: module.category || 'practical',
    }));

    function renderBar(labelEl, fillEl, items, emptyLabel) {
        if (!items.length) {
            labelEl.textContent = emptyLabel;
            fillEl.style.width = '0%';
            return;
        }
        const completedCount = items.filter((m) => m.status === 'completed').length;
        const percent = Math.round((completedCount / items.length) * 100);
        labelEl.textContent = `${completedCount} of ${items.length} complete (${percent}%)`;
        fillEl.style.width = `${percent}%`;
    }

    renderBar(progressLabel, progressFill, merged, 'No modules yet');
    renderBar(theoryProgressLabel, theoryProgressFill, merged.filter((m) => m.category === 'theory'), 'No theory modules');
    renderBar(practicalProgressLabel, practicalProgressFill, merged.filter((m) => m.category === 'practical'), 'No practical modules');

    const statusIcon = {
        completed: 'check_circle',
        'in-progress': 'radio_button_checked',
        locked: 'lock',
    };

    moduleList.innerHTML = merged
        .map(
            (module) => `
                <div class="module-item ${module.status === 'locked' ? 'locked' : ''}">
                    <div class="module-name">
                        <span class="material-symbols-outlined module-status-icon ${module.status}">${statusIcon[module.status] || 'radio_button_unchecked'}</span>
                        <span>${module.name}</span>
                    </div>
                </div>
            `
        )
        .join('');
}

// ---------------------------------------------------------------------------
// Notifications — personal, e.g. booking confirmations.
// ---------------------------------------------------------------------------
async function loadNotifications(clerkUserId) {
    const supabase = getSupabase();

    const { data: notifications, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('clerk_user_id', clerkUserId)
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        logLoadError('notifications', error);
    }

    if (!notifications?.length) {
        notificationsList.innerHTML = '<p style="color: var(--color-text-muted); font-size: 14px;">You have no notifications.</p>';
        return;
    }

    notificationsList.innerHTML = notifications
        .map(
            (item) => `
                <div class="notification-item ${item.read ? '' : 'unread'}">
                    <span class="material-symbols-outlined">notifications</span>
                    <div>
                        <div>${item.message}</div>
                        <div class="notification-time">${formatDate(item.created_at)}</div>
                    </div>
                </div>
            `
        )
        .join('');
}

// ---------------------------------------------------------------------------
// Announcements — school-wide, not tied to one student.
// ---------------------------------------------------------------------------
async function loadAnnouncements() {
    const supabase = getSupabase();

    const { data: announcements, error } = await supabase
        .from('announcements')
        .select('*')
        .order('published_at', { ascending: false })
        .limit(10);

    if (error) {
        logLoadError('announcements', error);
    }

    if (!announcements?.length) {
        announcementsList.innerHTML = '<p style="color: var(--color-text-muted); font-size: 14px;">No announcements at this time.</p>';
        return;
    }

    announcementsList.innerHTML = announcements
        .map(
            (item) => `
                <div class="announcement-item">
                    <h4>${item.title}</h4>
                    <div class="announcement-date">${formatDate(item.published_at)}</div>
                    <p>${item.body}</p>
                </div>
            `
        )
        .join('');
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
submitRegistrationBtn?.addEventListener('click', () => {
    if (currentClerkUser) {
        submitRegistration(currentClerkUser.id);
    }
});

requestLessonBtn?.addEventListener('click', () => {
    if (currentClerkUser) {
        submitLessonRequest(currentClerkUser.id);
    }
});

editProfileBtn?.addEventListener('click', openProfileEditForm);
saveProfileBtn?.addEventListener('click', saveProfileChanges);
cancelEditProfileBtn?.addEventListener('click', closeProfileEditForm);

contactInstructorBtn?.addEventListener('click', () => {
    if (currentInstructorEmail) {
        window.location.href = `mailto:${currentInstructorEmail}`;
    }
    // If there's no instructor assigned yet, this button intentionally
    // does nothing — there's no one to contact until a lesson is booked.
});

updatePasswordBtn?.addEventListener('click', async () => {
    const currentPassword = currentPasswordInput.value;
    const newPassword = newPasswordInput.value;

    if (!currentPassword || !newPassword) {
        return;
    }

    try {
        const clerk = await getClerk();
        await clerk.user.updatePassword({ currentPassword, newPassword, signOutOfOtherSessions: true });
        currentPasswordInput.value = '';
        newPasswordInput.value = '';
    } catch (err) {
        console.error('[student-portal] Failed to update password:', err);
    }
});

logoutBtn?.addEventListener('click', async () => {
    const clerk = await getClerk();
    await clerk.signOut();
    window.location.href = 'login.html';
});

// ---------------------------------------------------------------------------
// Mobile nav toggle — the sidebar's nav links collapse into a dropdown
// below the top bar on small screens; this button opens/closes it.
// ---------------------------------------------------------------------------
function setupMobileNav() {
    if (!portalMenuToggle || !portalNavLinks) return;

    function closeNav() {
        portalNavLinks.classList.remove('is-open');
        portalMenuToggle.setAttribute('aria-expanded', 'false');
    }

    portalMenuToggle.addEventListener('click', () => {
        const isOpen = portalNavLinks.classList.toggle('is-open');
        portalMenuToggle.setAttribute('aria-expanded', String(isOpen));
    });

    // Close the dropdown once a section link is tapped.
    portalNavLinks.querySelectorAll('.nav-link').forEach((link) => {
        link.addEventListener('click', closeNav);
    });
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
async function init() {
    const clerk = await requireSession();
    if (!clerk) return; // Redirecting to login.html

    setupMobileNav();

    currentClerkUser = clerk.user;
    const clerkUserId = clerk.user.id;

    const profile = await ensureProfile(clerk.user);
    currentProfile = profile;
    renderUserProfile(clerk.user, profile);

    const registration = await loadRegistration(clerkUserId);

    await Promise.all([
        loadLessons(clerkUserId),
        loadProgress(clerkUserId, registration),
        loadNotifications(clerkUserId),
        loadAnnouncements(),
    ]);
}

init();
