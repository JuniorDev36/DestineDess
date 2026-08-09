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
const moduleList = document.getElementById('moduleList');
const notificationsList = document.getElementById('notificationsList');
const contactInstructorBtn = document.getElementById('contactInstructorBtn');

const profileFullName = document.getElementById('profileFullName');
const profileEmail = document.getElementById('profileEmail');
const profilePhone = document.getElementById('profilePhone');
const profileDob = document.getElementById('profileDob');
const profileAddress = document.getElementById('profileAddress');

const registrationStatus = document.getElementById('registrationStatus');
const registrationPackage = document.getElementById('registrationPackage');
const registrationDate = document.getElementById('registrationDate');
const registrationNotes = document.getElementById('registrationNotes');

const upcomingLessonsTableBody = document.getElementById('upcomingLessonsTableBody');
const completedLessonsTableBody = document.getElementById('completedLessonsTableBody');
const announcementsList = document.getElementById('announcementsList');

const editProfileBtn = document.getElementById('editProfileBtn');
const bookLessonBtn = document.getElementById('bookLessonBtn');
const updatePasswordBtn = document.getElementById('updatePasswordBtn');
const currentPasswordInput = document.getElementById('currentPasswordInput');
const newPasswordInput = document.getElementById('newPasswordInput');
const logoutBtn = document.getElementById('logoutBtn');

let currentClerkUser = null;
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
        setText(registrationStatus, 'Not registered');
        setText(registrationPackage, null);
        setText(registrationDate, null);
        setText(registrationNotes, null);
        setText(dashboardPackage, null);
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

    return registration;
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

// ---------------------------------------------------------------------------
// Course progress + modules
// Theory-related modules only show for students whose package includes
// theory lessons (currently just the Advanced Package).
// ---------------------------------------------------------------------------
async function loadProgress(clerkUserId, registration) {
    const supabase = getSupabase();
    const includesTheory = registration?.packages?.includes_theory ?? false;

    const { data: modules, error: modulesError } = await supabase
        .from('course_modules')
        .select('id, name, sort_order, requires_theory')
        .order('sort_order', { ascending: true });

    if (modulesError) {
        logLoadError('course modules', modulesError);
    }

    const relevantModules = (modules || []).filter((m) => !m.requires_theory || includesTheory);

    if (!relevantModules.length) {
        setText(progressLabel, 'No modules yet');
        progressFill.style.width = '0%';
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
    }));

    const completedCount = merged.filter((m) => m.status === 'completed').length;
    const percent = Math.round((completedCount / merged.length) * 100);

    setText(progressLabel, `${completedCount} of ${merged.length} modules complete (${percent}%)`);
    progressFill.style.width = `${percent}%`;

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
editProfileBtn?.addEventListener('click', () => {
    // TODO: Open an edit-profile flow (modal or dedicated page) that writes
    // full_name/email back to Clerk and date_of_birth/address/phone to the
    // student_profiles table in Supabase, then re-run renderUserProfile().
});

bookLessonBtn?.addEventListener('click', () => {
    // TODO: Open a booking flow (modal or dedicated page) that inserts a
    // row into the lessons table, then re-run loadLessons().
});

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
// Init
// ---------------------------------------------------------------------------
async function init() {
    const clerk = await requireSession();
    if (!clerk) return; // Redirecting to login.html

    currentClerkUser = clerk.user;
    const clerkUserId = clerk.user.id;

    const profile = await ensureProfile(clerk.user);
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
