// admin-student.js
// Protects this page behind an admin session, loads one student's full
// profile (identified by ?student=<clerk_user_id> in the URL), and lets
// the admin assign a package, update module progress, and schedule
// lessons for them.

import { getClerk } from './clerk-client.js';
import { getSupabase } from './supabase-client.js';

// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------
const userInitials = document.getElementById('userInitials');
const userName = document.getElementById('userName');

const studentHeaderName = document.getElementById('studentHeaderName');
const studentStatusBadge = document.getElementById('studentStatusBadge');
const studentStatusText = document.getElementById('studentStatusText');
const studentEmail = document.getElementById('studentEmail');
const studentPhone = document.getElementById('studentPhone');
const studentDob = document.getElementById('studentDob');
const studentAddress = document.getElementById('studentAddress');

const currentPackageDisplay = document.getElementById('currentPackageDisplay');
const currentRegisteredDate = document.getElementById('currentRegisteredDate');
const assignPackageSelect = document.getElementById('assignPackageSelect');
const assignStatusSelect = document.getElementById('assignStatusSelect');
const assignNotesInput = document.getElementById('assignNotesInput');
const assignPackageError = document.getElementById('assignPackageError');
const assignPackageSuccess = document.getElementById('assignPackageSuccess');
const assignPackageBtn = document.getElementById('assignPackageBtn');

const adminProgressLabel = document.getElementById('adminProgressLabel');
const adminProgressFill = document.getElementById('adminProgressFill');
const adminModuleList = document.getElementById('adminModuleList');

const adminLessonsTableBody = document.getElementById('adminLessonsTableBody');
const scheduleLessonDate = document.getElementById('scheduleLessonDate');
const scheduleLessonTime = document.getElementById('scheduleLessonTime');
const scheduleLessonType = document.getElementById('scheduleLessonType');
const scheduleInstructorName = document.getElementById('scheduleInstructorName');
const scheduleInstructorEmail = document.getElementById('scheduleInstructorEmail');
const scheduleLessonError = document.getElementById('scheduleLessonError');
const scheduleLessonSuccess = document.getElementById('scheduleLessonSuccess');
const scheduleLessonBtn = document.getElementById('scheduleLessonBtn');

const portalMenuToggle = document.getElementById('portalMenuToggle');
const portalNavLinks = document.getElementById('portalNavLinks');
const logoutBtn = document.getElementById('logoutBtn');

const STATUS_CYCLE = ['locked', 'in-progress', 'completed'];

let targetStudentId = null;
let currentRegistration = null;

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
    console.error(`[admin-student] Failed to load ${section}:`, error);
}

// ---------------------------------------------------------------------------
// Route protection — admin only, and a valid ?student= id must be present.
// ---------------------------------------------------------------------------
async function requireAdminSession() {
    const clerk = await getClerk();

    if (!clerk.user) {
        window.location.href = 'login.html';
        return null;
    }

    if (clerk.user.publicMetadata?.role !== 'admin') {
        window.location.href = 'student-portal.html';
        return null;
    }

    document.body.style.display = '';
    return clerk;
}

function getTargetStudentId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('student');
}

// ---------------------------------------------------------------------------
// Mobile nav toggle — same pattern as the rest of the admin dashboard.
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

    portalNavLinks.querySelectorAll('.nav-link').forEach((link) => {
        link.addEventListener('click', closeNav);
    });
}

// ---------------------------------------------------------------------------
// Student profile header
// ---------------------------------------------------------------------------
async function loadStudentProfile() {
    const supabase = getSupabase();

    const { data: profile, error } = await supabase
        .from('student_profiles')
        .select('*')
        .eq('clerk_user_id', targetStudentId)
        .maybeSingle();

    if (error) {
        logLoadError('student profile', error);
    }

    if (!profile) {
        studentHeaderName.textContent = 'Student not found';
        return;
    }

    studentHeaderName.textContent = profile.full_name || 'Unnamed Student';
    setText(studentEmail, profile.email);
    setText(studentPhone, profile.phone);
    setText(studentDob, profile.date_of_birth ? formatDate(profile.date_of_birth) : null);
    setText(studentAddress, profile.address);
}

// ---------------------------------------------------------------------------
// Package assignment
// ---------------------------------------------------------------------------
async function loadPackageDropdown() {
    const supabase = getSupabase();

    const { data: packages, error } = await supabase
        .from('packages')
        .select('id, name')
        .order('sort_order', { ascending: true });

    if (error) {
        logLoadError('packages dropdown', error);
        assignPackageSelect.innerHTML = '<option value="">Could not load packages</option>';
        return;
    }

    assignPackageSelect.innerHTML = (packages || [])
        .map((pkg) => `<option value="${pkg.id}">${pkg.name}</option>`)
        .join('');
}

async function loadRegistration() {
    const supabase = getSupabase();

    const { data: registration, error } = await supabase
        .from('registrations')
        .select('*, packages(*)')
        .eq('clerk_user_id', targetStudentId)
        .order('registered_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        logLoadError('registration', error);
    }

    currentRegistration = registration || null;

    if (!registration) {
        currentPackageDisplay.textContent = 'No Package Purchased';
        currentRegisteredDate.textContent = '—';
        studentStatusText.textContent = 'Not registered';
        studentStatusBadge.classList.remove('success');
        return;
    }

    currentPackageDisplay.textContent = registration.packages?.name || 'Unknown Package';
    currentRegisteredDate.textContent = formatDate(registration.registered_at);
    studentStatusText.textContent = registration.status;
    studentStatusBadge.classList.toggle('success', registration.status === 'active' || registration.status === 'approved');

    // Pre-fill the assign form with the current values so re-saving is easy.
    if (registration.package_id) assignPackageSelect.value = registration.package_id;
    assignStatusSelect.value = registration.status;
    assignNotesInput.value = registration.notes || '';
}

function showAssignError(message) {
    assignPackageError.textContent = message;
    assignPackageError.style.display = 'block';
}

function clearAssignMessages() {
    assignPackageError.textContent = '';
    assignPackageError.style.display = 'none';
    assignPackageSuccess.textContent = '';
    assignPackageSuccess.style.display = 'none';
}

assignPackageBtn?.addEventListener('click', async () => {
    clearAssignMessages();

    const packageId = assignPackageSelect.value;
    const status = assignStatusSelect.value;
    const notes = assignNotesInput.value.trim();

    if (!packageId) {
        showAssignError('Please choose a package.');
        return;
    }

    assignPackageBtn.disabled = true;
    assignPackageBtn.style.opacity = '0.6';

    try {
        const supabase = getSupabase();

        if (currentRegistration) {
            const { error } = await supabase
                .from('registrations')
                .update({ package_id: packageId, status, notes })
                .eq('id', currentRegistration.id);
            if (error) throw error;
        } else {
            const { error } = await supabase
                .from('registrations')
                .insert({ clerk_user_id: targetStudentId, package_id: packageId, status, notes });
            if (error) throw error;
        }

        assignPackageSuccess.textContent = 'Package assigned. The student has been notified.';
        assignPackageSuccess.style.display = 'block';

        await loadRegistration();
        await loadModules();
    } catch (err) {
        logLoadError('package assignment', err);
        showAssignError('Could not assign the package. Please try again.');
    } finally {
        assignPackageBtn.disabled = false;
        assignPackageBtn.style.opacity = '';
    }
});

// ---------------------------------------------------------------------------
// Course modules — package-specific if the package defines its own
// curriculum, otherwise the global theory-gated curriculum (same logic
// the student portal uses).
// ---------------------------------------------------------------------------
function nextStatus(status) {
    const index = STATUS_CYCLE.indexOf(status);
    return STATUS_CYCLE[(index + 1) % STATUS_CYCLE.length];
}

async function loadModules() {
    if (!currentRegistration?.package_id) {
        adminModuleList.innerHTML = '<p style="color: var(--color-text-muted); font-size: 14px;">Assign a package to see its modules.</p>';
        adminProgressLabel.textContent = '—';
        adminProgressFill.style.width = '0%';
        return;
    }

    const supabase = getSupabase();
    const includesTheory = currentRegistration.packages?.includes_theory ?? false;

    // Prefer modules scoped to this exact package; fall back to the
    // global theory-gated curriculum if the package has none of its own.
    const { data: packageModules, error: packageModulesError } = await supabase
        .from('course_modules')
        .select('id, name, sort_order')
        .eq('package_id', currentRegistration.package_id)
        .order('sort_order', { ascending: true });

    if (packageModulesError) {
        logLoadError('package modules', packageModulesError);
    }

    let modules = packageModules || [];

    if (!modules.length) {
        const { data: globalModules, error: globalModulesError } = await supabase
            .from('course_modules')
            .select('id, name, sort_order, requires_theory')
            .is('package_id', null)
            .order('sort_order', { ascending: true });

        if (globalModulesError) {
            logLoadError('global modules', globalModulesError);
        }

        modules = (globalModules || []).filter((m) => !m.requires_theory || includesTheory);
    }

    if (!modules.length) {
        adminModuleList.innerHTML = '<p style="color: var(--color-text-muted); font-size: 14px;">This package has no modules defined yet.</p>';
        return;
    }

    const { data: progressRows, error: progressError } = await supabase
        .from('student_module_progress')
        .select('module_id, status')
        .eq('clerk_user_id', targetStudentId);

    if (progressError) {
        logLoadError('module progress', progressError);
    }

    const progressByModule = new Map((progressRows || []).map((row) => [row.module_id, row.status]));

    const merged = modules.map((m) => ({
        id: m.id,
        name: m.name,
        status: progressByModule.get(m.id) || 'locked',
    }));

    const completedCount = merged.filter((m) => m.status === 'completed').length;
    const percent = Math.round((completedCount / merged.length) * 100);
    adminProgressLabel.textContent = `${completedCount} of ${merged.length} modules complete (${percent}%)`;
    adminProgressFill.style.width = `${percent}%`;

    adminModuleList.innerHTML = merged
        .map(
            (m) => `
                <div class="module-item">
                    <div class="module-name">
                        <span>${m.name}</span>
                    </div>
                    <button class="module-status-btn ${m.status}" data-module-id="${m.id}" data-status="${m.status}" type="button">${m.status}</button>
                </div>
            `
        )
        .join('');

    adminModuleList.querySelectorAll('.module-status-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const moduleId = btn.dataset.moduleId;
            const newStatus = nextStatus(btn.dataset.status);

            btn.disabled = true;
            try {
                const supabase = getSupabase();
                const { error } = await supabase
                    .from('student_module_progress')
                    .upsert(
                        { clerk_user_id: targetStudentId, module_id: moduleId, status: newStatus },
                        { onConflict: 'clerk_user_id,module_id' }
                    );
                if (error) throw error;
                await loadModules();
            } catch (err) {
                logLoadError('module status update', err);
                btn.disabled = false;
            }
        });
    });
}

// ---------------------------------------------------------------------------
// Lessons — view all + schedule new ones + mark complete.
// ---------------------------------------------------------------------------
async function loadLessons() {
    const supabase = getSupabase();

    const { data: lessons, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('clerk_user_id', targetStudentId)
        .order('lesson_date', { ascending: true });

    if (error) {
        logLoadError('lessons', error);
    }

    if (!lessons?.length) {
        adminLessonsTableBody.innerHTML = '<tr><td colspan="6">No lessons scheduled yet.</td></tr>';
        return;
    }

    adminLessonsTableBody.innerHTML = lessons
        .map((lesson) => {
            const badgeClass = lesson.status === 'completed' ? 'badge success' : 'badge';
            const actionCell = lesson.status === 'upcoming'
                ? `<button class="btn btn-small" data-lesson-id="${lesson.id}" type="button">Mark Completed</button>`
                : '';
            return `
                <tr>
                    <td>${formatDate(lesson.lesson_date)}</td>
                    <td>${lesson.lesson_time}</td>
                    <td>${lesson.lesson_type}</td>
                    <td>${lesson.instructor_name || '—'}</td>
                    <td><span class="${badgeClass}">${lesson.status}</span></td>
                    <td class="lesson-actions-cell">${actionCell}</td>
                </tr>
            `;
        })
        .join('');

    adminLessonsTableBody.querySelectorAll('button[data-lesson-id]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            btn.disabled = true;
            try {
                const supabase = getSupabase();
                const { error } = await supabase
                    .from('lessons')
                    .update({ status: 'completed' })
                    .eq('id', btn.dataset.lessonId);
                if (error) throw error;
                await loadLessons();
            } catch (err) {
                logLoadError('lesson completion', err);
                btn.disabled = false;
            }
        });
    });
}

function showScheduleError(message) {
    scheduleLessonError.textContent = message;
    scheduleLessonError.style.display = 'block';
}

function clearScheduleMessages() {
    scheduleLessonError.textContent = '';
    scheduleLessonError.style.display = 'none';
    scheduleLessonSuccess.textContent = '';
    scheduleLessonSuccess.style.display = 'none';
}

scheduleLessonBtn?.addEventListener('click', async () => {
    clearScheduleMessages();

    const date = scheduleLessonDate.value;
    const time = scheduleLessonTime.value.trim();
    const type = scheduleLessonType.value.trim();
    const instructorName = scheduleInstructorName.value.trim();
    const instructorEmail = scheduleInstructorEmail.value.trim();

    if (!date || !time || !type) {
        showScheduleError('Please fill in date, time, and lesson type.');
        return;
    }

    scheduleLessonBtn.disabled = true;
    scheduleLessonBtn.style.opacity = '0.6';

    try {
        const supabase = getSupabase();
        const { error } = await supabase.from('lessons').insert({
            clerk_user_id: targetStudentId,
            lesson_date: date,
            lesson_time: time,
            lesson_type: type,
            instructor_name: instructorName || null,
            instructor_email: instructorEmail || null,
            status: 'upcoming',
        });
        if (error) throw error;

        scheduleLessonSuccess.textContent = 'Lesson scheduled. The student has been notified.';
        scheduleLessonSuccess.style.display = 'block';
        scheduleLessonDate.value = '';
        scheduleLessonTime.value = '';
        scheduleLessonType.value = '';
        scheduleInstructorName.value = '';
        scheduleInstructorEmail.value = '';

        await loadLessons();
    } catch (err) {
        logLoadError('lesson scheduling', err);
        showScheduleError('Could not schedule the lesson. Please try again.');
    } finally {
        scheduleLessonBtn.disabled = false;
        scheduleLessonBtn.style.opacity = '';
    }
});

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------
logoutBtn?.addEventListener('click', async () => {
    const clerk = await getClerk();
    await clerk.signOut();
    window.location.href = 'login.html';
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
async function init() {
    const clerk = await requireAdminSession();
    if (!clerk) return; // Redirecting away

    setupMobileNav();

    const fullName = clerk.user.fullName || [clerk.user.firstName, clerk.user.lastName].filter(Boolean).join(' ');
    userName.textContent = fullName || 'Admin';
    userInitials.textContent = getInitials(fullName);

    targetStudentId = getTargetStudentId();

    if (!targetStudentId) {
        studentHeaderName.textContent = 'No student selected';
        return;
    }

    await loadStudentProfile();
    await loadPackageDropdown();
    await loadRegistration();

    await Promise.all([
        loadModules(),
        loadLessons(),
    ]);
}

init();
