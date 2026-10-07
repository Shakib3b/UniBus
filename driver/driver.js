const SUPABASE_URL = "https://hkgokigrymuslbbtwfpb.supabase.co";

const SUPABASE_ANON_KEY =
    "sb_publishable_BqjPT0XpHgK_44BdZ7K7ag_3hthBXBL";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);


// ===============================
// LOAD DRIVER INFORMATION
// ===============================

async function loadDriverDashboard() {

    try {

        // Get logged-in user
        const {
            data: { user },
            error: userError
        } = await supabaseClient.auth.getUser();

        if (userError || !user) {
            throw new Error("Driver is not logged in.");
        }


        // Get driver profile
        const { data: driver, error: driverError } =
            await supabaseClient
                .from("drivers")
                .select(`
                    id,
                    full_name,
                    phone,
                    license_number,
                    bus_id,
                    is_active
                `)
                .eq("id", user.id)
                .single();


        if (driverError) {
            throw driverError;
        }


        if (!driver) {
            throw new Error("Driver information not found.");
        }


        // Show driver name
        document.getElementById("driverName").textContent =
            driver.full_name || "Driver";


        // Check assigned bus
        if (!driver.bus_id) {

            document.getElementById("busNumber").textContent =
                "No bus assigned";

            document.getElementById("routeName").textContent =
                "No route assigned";

            return;
        }


        // Get assigned bus
        const { data: bus, error: busError } =
            await supabaseClient
                .from("buses")
                .select(`
                    id,
                    bus_number,
                    bus_name
                `)
                .eq("id", driver.bus_id)
                .single();


        if (busError) {
            throw busError;
        }


        document.getElementById("busNumber").textContent =
            bus.bus_number;


        document.getElementById("busName").textContent =
            bus.bus_name || "University Bus";


        // Get bus-route assignment
        const { data: assignment, error: assignmentError } =
            await supabaseClient
                .from("bus_route_assignments")
                .select(`
                    route_id
                `)
                .eq("bus_id", driver.bus_id)
                .eq("is_active", true)
                .maybeSingle();


        if (assignmentError) {
            throw assignmentError;
        }


        if (!assignment) {

            document.getElementById("routeName").textContent =
                "No route assigned";

            return;
        }


        // Get route
        const { data: route, error: routeError } =
            await supabaseClient
                .from("routes")
                .select(`
                    id,
                    route_name,
                    description,
                    route_geometry
                `)
                .eq("id", assignment.route_id)
                .single();


        if (routeError) {
            throw routeError;
        }


        document.getElementById("routeName").textContent =
            route.route_name;


        document.getElementById("routeDescription").textContent =
            route.description || "No route description";


        // Load route stops
        await loadRouteStops(route.id);

    } catch (error) {

        console.error("Driver dashboard error:", error);

        document.getElementById("dashboardMessage").textContent =
            "Unable to load driver information.";

    }
}


// ===============================
// LOAD ROUTE STOPS
// ===============================

async function loadRouteStops(routeId) {

    const { data, error } =
        await supabaseClient
            .from("route_stops")
            .select(`
                stop_order,
                stops (
                    id,
                    stop_name,
                    latitude,
                    longitude
                )
            `)
            .eq("route_id", routeId)
            .order("stop_order", { ascending: true });


    if (error) {
        throw error;
    }


    const stopList =
        document.getElementById("stopList");

    stopList.innerHTML = "";


    if (!data || data.length === 0) {

        stopList.innerHTML =
            "<li>No stops assigned to this route.</li>";

        return;
    }


    data.forEach(item => {

        const li = document.createElement("li");

        li.innerHTML = `
            <strong>${item.stop_order}.</strong>
            ${item.stops.stop_name}
        `;

        stopList.appendChild(li);

    });
}


// ===============================
// INITIALIZE
// ===============================

loadDriverDashboard();