// admin-dashboard.js
// Protects the Admin Dashboard behind a real Clerk session AND an admin
// role check, then populates the overview stats, student list, and
// announcements management.

import { getClerk } from './clerk-client.js';
import { getSupabase } from './supabase-client.js';

// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------
const userInitials = document.getElementById('userInitials');
const userName = document.getElementById('userName');

const statStudents = document.getElementById('statStudents');
const statPackagesSold = document.getElementById('statPackagesSold');
const statTodaysLessons = document.getElementById('statTodaysLessons');
const statPendingApprovals = document.getElementById('statPendingApprovals');

const studentSearchInput = document.getElementById('studentSearchInput');
const studentsTableBody = document.getElementById('studentsTableBody');

const announcementsList = document.getElementById('announcementsList');
const newAnnouncementTitle = document.getElementById('newAnnouncementTitle');
const newAnnouncementBody = document.getElementById('newAnnouncementBody');
const announcementFormError = document.getElementById('announcementFormError');
const postAnnouncementBtn = document.getElementById('postAnnouncementBtn');

const portalMenuToggle = document.getElementById('portalMenuToggle');
const portalNavLinks = document.getElementById('portalNavLinks');
const logoutBtn = document.getElementById('logoutBtn');

let allStudentRows = [];
let currentSort = { key: 'name', direction: 'asc' };

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

function logLoadError(section, error) {
    console.error(`[admin-dashboard] Failed to load ${section}:`, error);
}

// ---------------------------------------------------------------------------
// Route protection — must be signed in AND have role: 'admin' in Clerk's
// public metadata. Anyone else is redirected away before anything renders.
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

// ---------------------------------------------------------------------------
// Mobile nav toggle — same pattern as the student portal.
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
// Overview stats
// ---------------------------------------------------------------------------
async function loadOverviewStats() {
    const supabase = getSupabase();
    const today = new Date().toISOString().slice(0, 10);

    const [studentsRes, packagesSoldRes, todaysLessonsRes, pendingRes] = await Promise.all([
        supabase.from('student_profiles').select('id', { count: 'exact', head: true }),
        supabase.from('registrations').select('id', { count: 'exact', head: true }).in('status', ['active', 'approved', 'completed']),
        supabase.from('lessons').select('id', { count: 'exact', head: true }).eq('lesson_date', today),
        supabase.from('registrations').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);

    [studentsRes, packagesSoldRes, todaysLessonsRes, pendingRes].forEach((res, i) => {
        if (res.error) logLoadError(['students count', 'packages sold', "today's lessons", 'pending approvals'][i], res.error);
    });

    statStudents.textContent = studentsRes.count ?? '—';
    statPackagesSold.textContent = packagesSoldRes.count ?? '—';
    statTodaysLessons.textContent = todaysLessonsRes.count ?? '—';
    statPendingApprovals.textContent = pendingRes.count ?? '—';
}

// ---------------------------------------------------------------------------
// Student list — search + sort, links to admin-student.html
// ---------------------------------------------------------------------------
function renderStudentRows() {
    const query = studentSearchInput.value.trim().toLowerCase();

    let rows = allStudentRows.filter((row) => {
        if (!query) return true;
        return row.name.toLowerCase().includes(query) || row.email.toLowerCase().includes(query);
    });

    const { key, direction } = currentSort;
    rows = [...rows].sort((a, b) => {
        const aVal = (a[key] || '').toString().toLowerCase();
        const bVal = (b[key] || '').toString().toLowerCase();
        if (aVal < bVal) return direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    if (!rows.length) {
        studentsTableBody.innerHTML = '<tr><td colspan="5">No students match your search.</td></tr>';
        return;
    }

    studentsTableBody.innerHTML = rows
        .map(
            (row) => `
                <tr data-clerk-user-id="${row.clerkUserId}">
                    <td>${row.name || '—'}</td>
                    <td>${row.email || '—'}</td>
                    <td>${row.package || '—'}</td>
                    <td>${row.status ? `<span class="badge ${row.status === 'pending' ? 'pending' : row.status === 'active' || row.status === 'approved' ? 'success' : ''}">${row.status}</span>` : '—'}</td>
                    <td>${formatDate(row.registeredAt)}</td>
                </tr>
            `
        )
        .join('');

    studentsTableBody.querySelectorAll('tr[data-clerk-user-id]').forEach((tr) => {
        tr.addEventListener('click', () => {
            const id = tr.getAttribute('data-clerk-user-id');
            window.location.href = `admin-student.html?student=${encodeURIComponent(id)}`;
        });
    });
}

async function loadStudents() {
    const supabase = getSupabase();

    const { data: profiles, error: profilesError } = await supabase
        .from('student_profiles')
        .select('clerk_user_id, full_name, email');

    if (profilesError) {
        logLoadError('student profiles', profilesError);
        studentsTableBody.innerHTML = '<tr><td colspan="5">Could not load students.</td></tr>';
        return;
    }

    const { data: registrations, error: registrationsError } = await supabase
        .from('registrations')
        .select('clerk_user_id, status, registered_at, packages(name)')
        .order('registered_at', { ascending: false });

    if (registrationsError) {
        logLoadError('registrations', registrationsError);
    }

    // Keep only each student's most recent registration.
    const latestRegistrationByStudent = new Map();
    (registrations || []).forEach((reg) => {
        if (!latestRegistrationByStudent.has(reg.clerk_user_id)) {
            latestRegistrationByStudent.set(reg.clerk_user_id, reg);
        }
    });

    allStudentRows = (profiles || []).map((profile) => {
        const reg = latestRegistrationByStudent.get(profile.clerk_user_id);
        return {
            clerkUserId: profile.clerk_user_id,
            name: profile.full_name || '',
            email: profile.email || '',
            package: reg?.packages?.name || '',
            status: reg?.status || '',
            registeredAt: reg?.registered_at || null,
        };
    });

    renderStudentRows();
}

studentSearchInput?.addEventListener('input', renderStudentRows);

document.querySelectorAll('#students th[data-sort]').forEach((th) => {
    th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if (currentSort.key === key) {
            currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            currentSort = { key, direction: 'asc' };
        }
        renderStudentRows();
    });
});

// ---------------------------------------------------------------------------
// Announcements — admin can view and post school-wide announcements.
// ---------------------------------------------------------------------------
async function loadAnnouncements() {
    const supabase = getSupabase();

    const { data: announcements, error } = await supabase
        .from('announcements')
        .select('*')
        .order('published_at', { ascending: false })
        .limit(20);

    if (error) {
        logLoadError('announcements', error);
    }

    if (!announcements?.length) {
        announcementsList.innerHTML = '<p style="color: var(--color-text-muted); font-size: 14px;">No announcements yet.</p>';
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

function showAnnouncementFormError(message) {
    announcementFormError.textContent = message;
    announcementFormError.style.display = 'block';
}

function clearAnnouncementFormError() {
    announcementFormError.textContent = '';
    announcementFormError.style.display = 'none';
}

postAnnouncementBtn?.addEventListener('click', async () => {
    clearAnnouncementFormError();

    const title = newAnnouncementTitle.value.trim();
    const body = newAnnouncementBody.value.trim();

    if (!title || !body) {
        showAnnouncementFormError('Please fill in both a title and a message.');
        return;
    }

    postAnnouncementBtn.disabled = true;
    postAnnouncementBtn.style.opacity = '0.6';

    try {
        const supabase = getSupabase();
        const { error } = await supabase.from('announcements').insert({ title, body });
        if (error) throw error;

        newAnnouncementTitle.value = '';
        newAnnouncementBody.value = '';
        await loadAnnouncements();
    } catch (err) {
        logLoadError('announcement posting', err);
        showAnnouncementFormError('Could not post the announcement. Please try again.');
    } finally {
        postAnnouncementBtn.disabled = false;
        postAnnouncementBtn.style.opacity = '';
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

    await Promise.all([
        loadOverviewStats(),
        loadStudents(),
        loadAnnouncements(),
    ]);
}

init();
