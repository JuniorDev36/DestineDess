// clerk-client.js
// Shared helper for waiting on the Clerk CDN script to finish loading and
// initializing. Every page that needs Clerk (register, login,
// forgot-password, student-portal) imports getClerk() from here instead of
// duplicating the "wait for window.Clerk" polling logic.
//
// Requires the Clerk CDN script tag to already be present in the page's
// <head>, e.g.:
//
// <script
//   async
//   crossorigin="anonymous"
//   data-clerk-publishable-key="pk_test_..."
//   src="https://your-frontend-api.clerk.accounts.dev/npm/@clerk/clerk-js@latest/dist/clerk.browser.js"
//   type="text/javascript"
// ></script>

let clerkReadyPromise = null;

export function getClerk() {
    if (clerkReadyPromise) {
        return clerkReadyPromise;
    }

    clerkReadyPromise = new Promise((resolve, reject) => {
        const maxAttempts = 200; // ~10 seconds at 50ms intervals
        let attempts = 0;

        function tryInit() {
            if (window.Clerk) {
                window.Clerk.load()
                    .then(() => resolve(window.Clerk))
                    .catch(reject);
                return;
            }

            attempts += 1;
            if (attempts >= maxAttempts) {
                reject(new Error('Clerk failed to load. Check your publishable key and internet connection.'));
                return;
            }

            setTimeout(tryInit, 50);
        }

        tryInit();
    });

    return clerkReadyPromise;
}
