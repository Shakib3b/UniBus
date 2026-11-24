
document.addEventListener("DOMContentLoaded", async () => {

    // ==========================================
    // AUTHENTICATION
    // ==========================================

    await protectPage("user");

    const {
        data: { user },
        error: userError
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
        return;
    }

    // ==========================================
    // ELEMENTS
    // ==========================================

    const studentNameEl = document.getElementById("studentName");
    const welcomeNameEl = document.getElementById("welcomeName");
    const profileNameEl = document.getElementById("profileName");
    const loginIdEl = document.getElementById("loginId");

    const accountFullNameEl = document.getElementById("accountFullName");
    const studentAvatarEl = document.getElementById("studentAvatar");
    const accountAvatarEl = document.getElementById("accountAvatar");

    const busCountEl = document.getElementById("busCount");
    const activeBusCountEl = document.getElementById("activeBusCount");
    const routeCountEl = document.getElementById("routeCount");

    const busListEl = document.getElementById("busList");
    const routeListEl = document.getElementById("routeList");

    const refreshBtn = document.getElementById("refreshBtn");
    const logoutBtn = document.getElementById("logoutBtn");

    // ==========================================
    // PROFILE
    // ==========================================

    async function loadProfile() {

        const {
            data: profile,
            error
        } = await supabaseClient
            .from("profiles")
            .select("full_name, login_id, role")
            .eq("id", user.id)
            .single();

        if (error || !profile) {
            console.error("Profile loading error:", error);
            showToast("Could not load profile.");
            return;
        }

        const name = profile.full_name || profile.login_id || "Student";
        const firstLetter = name.charAt(0).toUpperCase();

        studentNameEl.textContent = name;
        welcomeNameEl.textContent = name;
        profileNameEl.textContent = name;
        accountFullNameEl.textContent = name;

        loginIdEl.textContent = profile.login_id || "Not available";

        studentAvatarEl.textContent = firstLetter;
        accountAvatarEl.textContent = firstLetter;
    }

    // ==========================================
    // LOAD BUSES AND ROUTES
    // ==========================================

    async function loadTransportData() {

        busListEl.innerHTML = `
            <div class="loading-card">Loading buses...</div>
        `;

        routeListEl.innerHTML = `
            <div class="loading-card">Loading routes...</div>
        `;

        try {

            // Load buses
            const {
                data: buses,
                error: busError
            } = await supabaseClient
                .from("buses")
                .select("*")
                .order("bus_number");

            if (busError) {
                throw busError;
            }

            // Load routes
            const {
                data: routes,
                error: routeError
            } = await supabaseClient
                .from("routes")
                .select("*")
                .order("route_name");

            if (routeError) {
                throw routeError;
            }

            // Load bus-route assignments
            const {
                data: assignments,
                error: assignmentError
            } = await supabaseClient
                .from("bus_route_assignments")
                .select("*");

            if (assignmentError) {
                throw assignmentError;
            }

            // Load route stops
            const {
                data: routeStops,
                error: routeStopError
            } = await supabaseClient
                .from("route_stops")
                .select("*")
                .order("stop_order");

            if (routeStopError) {
                throw routeStopError;
            }

            // Load stop information
            const {
                data: stops,
                error: stopError
            } = await supabaseClient
                .from("stops")
                .select("*");

            if (stopError) {
                throw stopError;
            }

            // ======================================
            // FILTER ACTIVE RECORDS
            // ======================================

            const activeBuses = (buses || []).filter(
                bus => bus.is_active === true
            );

            const activeRoutes = (routes || []).filter(
                route => route.is_active === true
            );

            const activeAssignments = (assignments || []).filter(
                assignment => assignment.is_active === true
            );

            // ======================================
            // STATISTICS
            // ======================================

            busCountEl.textContent = activeBuses.length;

            activeBusCountEl.textContent = activeBuses.length;

            routeCountEl.textContent = activeRoutes.length;

            // ======================================
            // DISPLAY BUS INFORMATION
            // ======================================

            renderBuses(
                activeBuses,
                activeRoutes,
                activeAssignments
            );

            // ======================================
            // DISPLAY ROUTES
            // ======================================

            renderRoutes(
                activeRoutes,
                routeStops || [],
                stops || []
            );

            console.log("Transport data loaded successfully.");

        } catch (error) {

            console.error("Transport data loading error:", error);

            busListEl.innerHTML = `
                <div class="error-card">
                    Could not load bus information.
                    <br><br>
                    ${escapeHTML(error.message)}
                </div>
            `;

            routeListEl.innerHTML = `
                <div class="error-card">
                    Could not load route information.
                    <br><br>
                    ${escapeHTML(error.message)}
                </div>
            `;

            busCountEl.textContent = "--";
            activeBusCountEl.textContent = "--";
            routeCountEl.textContent = "--";
        }
    }

    // ==========================================
    // RENDER BUS CARDS
    // ==========================================

    function renderBuses(buses, routes, assignments) {

        if (!buses.length) {
            busListEl.innerHTML = `
                <div class="empty-card">
                    No active buses are currently available.
                </div>
            `;
            return;
        }

        busListEl.innerHTML = "";

        buses.forEach(bus => {

            const assignment = assignments.find(
                item => item.bus_id === bus.id
            );

            const route = assignment
                ? routes.find(item => item.id === assignment.route_id)
                : null;

            const busName = bus.bus_name || bus.bus_number || "University Bus";

            const routeName = route
                ? route.route_name
                : "No route assigned";

            const status = bus.is_active
                ? "Active"
                : "Inactive";

            const card = document.createElement("div");

            card.className = "bus-card";

            card.innerHTML = `
                <div class="bus-card-top">

                    <div class="bus-card-title">

                        <div class="bus-icon">🚌</div>

                        <div>
                            <h3>${escapeHTML(busName)}</h3>

                            <p class="bus-number">
                                Bus Number: ${escapeHTML(bus.bus_number || "N/A")}
                            </p>
                        </div>

                    </div>

                    <span class="status-badge active">
                        ${status}
                    </span>

                </div>

                <div class="bus-info-row">
                    <span class="bus-info-icon">🗺️</span>

                    <div class="bus-info-text">
                        Route:
                        <strong>${escapeHTML(routeName)}</strong>
                    </div>
                </div>

                <div class="bus-info-row">
                    <span class="bus-info-icon">📍</span>

                    <div class="bus-info-text">
                        Tracking:
                        <strong>Live tracking will be available soon</strong>
                    </div>
                </div>

                <div class="bus-card-footer">

                    <span class="bus-route-label">
                        University Transportation
                    </span>

                    <button
                        class="track-btn"
                        disabled
                        title="Live tracking is under development"
                    >
                        Track Bus
                    </button>

                </div>
            `;

            busListEl.appendChild(card);
        });
    }

    // ==========================================
    // RENDER ROUTES AND STOPS
    // ==========================================

    function renderRoutes(routes, routeStops, stops) {

        if (!routes.length) {
            routeListEl.innerHTML = `
                <div class="empty-card">
                    No active routes are currently available.
                </div>
            `;
            return;
        }

        routeListEl.innerHTML = "";

        routes.forEach(route => {

            // Get stops belonging to this route
            const currentRouteStops = routeStops
                .filter(item => item.route_id === route.id)
                .sort((a, b) => a.stop_order - b.stop_order);

            // Match stop IDs to actual stop records
            const routeStopDetails = currentRouteStops.map(item => {

                const stop = stops.find(
                    s => s.id === item.stop_id
                );

                return {
                    order: item.stop_order,
                    name: stop ? stop.stop_name : "Unknown stop"
                };
            });

            const card = document.createElement("div");

            card.className = "route-card";

            let stopsHTML = "";

            if (routeStopDetails.length) {

                stopsHTML = routeStopDetails.map(stop => `
                    <div class="stop-chip">
                        <span>${stop.order}.</span>
                        ${escapeHTML(stop.name)}
                    </div>
                `).join("");

            } else {

                stopsHTML = `
                    <p class="no-stops">
                        No stops have been added to this route yet.
                    </p>
                `;
            }

            card.innerHTML = `
                <div class="route-card-header">

                    <div>
                        <h3>🗺️ ${escapeHTML(route.route_name)}</h3>

                        <p class="route-description">
                            ${escapeHTML(route.description || "University bus route")}
                        </p>
                    </div>

                    <span class="route-stop-count">
                        ${routeStopDetails.length} Stops
                    </span>

                </div>

                <div class="stops-list">
                    ${stopsHTML}
                </div>
            `;

            routeListEl.appendChild(card);
        });
    }

    // ==========================================
    // HTML ESCAPING
    // ==========================================

    function escapeHTML(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // ==========================================
    // TOAST
    // ==========================================

    function showToast(message) {

        const toast = document.getElementById("toast");

        toast.textContent = message;
        toast.classList.add("show");

        setTimeout(() => {
            toast.classList.remove("show");
        }, 3000);
    }

    // ==========================================
    // REFRESH
    // ==========================================

    refreshBtn.addEventListener("click", async () => {

        refreshBtn.disabled = true;
        refreshBtn.textContent = "Loading...";

        await loadTransportData();

        refreshBtn.disabled = false;
        refreshBtn.textContent = "↻ Refresh";

        showToast("Dashboard refreshed.");
    });

    // ==========================================
    // LOGOUT
    // ==========================================

    logoutBtn.addEventListener("click", async () => {

        logoutBtn.disabled = true;
        logoutBtn.textContent = "Logging out...";

        const { error } = await supabaseClient.auth.signOut();

        if (error) {

            console.error("Logout error:", error);

            showToast("Could not log out.");

            logoutBtn.disabled = false;
            logoutBtn.textContent = "Logout";

            return;
        }

        window.location.href = "/";
    });

    // ==========================================
    // SIDEBAR NAVIGATION
    // ==========================================

    const navLinks = document.querySelectorAll(".nav-link");

    navLinks.forEach(link => {

        link.addEventListener("click", () => {

            navLinks.forEach(item => {
                item.classList.remove("active");
            });

            link.classList.add("active");
        });
    });

    // ==========================================
    // INITIAL LOAD
    // ==========================================

    await loadProfile();

    await loadTransportData();

});
